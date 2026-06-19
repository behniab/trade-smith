import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---- WorkWave API helpers ----

function wwHeaders(apiKey: string) {
  return { 'Content-Type': 'application/json', 'X-WorkWave-Key': apiKey }
}

async function wwGet(baseUrl: string, apiKey: string, path: string) {
  const res = await fetch(`${baseUrl}${path}`, { headers: wwHeaders(apiKey) })
  if (!res.ok) throw new Error(`WorkWave ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function wwPost(baseUrl: string, apiKey: string, path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: wwHeaders(apiKey), body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`WorkWave ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

// ---- Sync helpers ----

async function logSync(
  supabase: ReturnType<typeof createAdminClient>,
  entity_type: string, entity_id: string | null,
  status: 'ok' | 'error' | 'pending',
  opts: { requestId?: string; error?: string; payload?: unknown } = {}
) {
  await supabase.from('sync_log').insert({
    entity_type, entity_id,
    status,
    workwave_request_id: opts.requestId ?? null,
    error_message: opts.error ?? null,
    payload: opts.payload ?? null,
  })
}

// ---- Sync functions per entity type ----

async function syncClient(supabase: ReturnType<typeof createAdminClient>, clientId: string, cfg: { baseUrl: string; apiKey: string }) {
  const { data: client, error } = await supabase.from('clients').select('*').eq('id', clientId).single()
  if (error || !client) throw new Error('Client not found')

  const body = { name: client.name, enabled: true }

  if (client.workwave_id) {
    await wwPost(cfg.baseUrl, cfg.apiKey, `/api/v1/companies/${client.workwave_id}`, body)
    await logSync(supabase, 'client', clientId, 'ok', { payload: body })
    return { action: 'updated', workwave_id: client.workwave_id }
  } else {
    const result = await wwPost(cfg.baseUrl, cfg.apiKey, '/api/v1/companies', body)
    const wid = result?.id ?? result?.requestId ?? null
    if (wid) {
      await supabase.from('clients').update({ workwave_id: wid }).eq('id', clientId)
    }
    await logSync(supabase, 'client', clientId, 'ok', { requestId: result?.requestId, payload: body })
    return { action: 'created', workwave_id: wid, requestId: result?.requestId }
  }
}

async function syncJob(supabase: ReturnType<typeof createAdminClient>, jobId: string, cfg: { baseUrl: string; apiKey: string; territoryId: string }) {
  const { data: job } = await supabase
    .from('jobs')
    .select('*, clients(name, address, workwave_id), quotes(estimate)')
    .eq('id', jobId)
    .single()
  if (!job) throw new Error('Job not found')

  const client = job.clients as { name: string; address: string | null; workwave_id: string | null } | null
  const estimate = job.quotes?.[0]?.estimate

  const order = {
    name: job.title,
    notes: job.description,
    companyCd: client?.workwave_id ?? null,
    date: job.scheduled_date?.slice(0, 10).replace(/-/g, '') ?? null,
    serviceTimeSec: estimate?.labor_hours ? Math.round(estimate.labor_hours * 3600) : 3600,
    customField1: `aloha-water-job-${jobId}`,
    loads: estimate?.total ? [{ type: 'revenue', size: Math.round(estimate.total * 100) }] : [],
    ...(client?.address ? { location: { address: client.address } } : {}),
  }

  const result = await wwPost(cfg.baseUrl, cfg.apiKey,
    `/api/v1/territories/${cfg.territoryId}/orders`, order)

  await supabase.from('jobs').update({ workwave_order_id: result?.requestId ?? null }).eq('id', jobId)
  await logSync(supabase, 'job', jobId, 'ok', { requestId: result?.requestId, payload: order })
  return { action: 'synced', requestId: result?.requestId }
}

async function syncQuote(supabase: ReturnType<typeof createAdminClient>, quoteId: string, cfg: { baseUrl: string; apiKey: string; territoryId: string }) {
  const { data: quote } = await supabase
    .from('quotes')
    .select('*, jobs(title, description, scheduled_date, clients(name, address, workwave_id))')
    .eq('id', quoteId)
    .single()
  if (!quote) throw new Error('Quote not found')

  const job = quote.jobs as { title: string; description: string; scheduled_date: string | null; clients: { name: string; address: string | null; workwave_id: string | null } | null } | null
  const estimate = quote.estimate as { total: number; labor_hours: number }

  const order = {
    name: `Quote: ${job?.title ?? 'Service'}`,
    notes: `Estimated total: $${estimate?.total?.toFixed(2)} | ${job?.description ?? ''}`.trim(),
    companyCd: job?.clients?.workwave_id ?? null,
    date: job?.scheduled_date?.slice(0, 10).replace(/-/g, '') ?? null,
    serviceTimeSec: estimate?.labor_hours ? Math.round(estimate.labor_hours * 3600) : 3600,
    customField1: `aloha-water-quote-${quoteId}`,
    loads: estimate?.total ? [{ type: 'revenue', size: Math.round(estimate.total * 100) }] : [],
    ...(job?.clients?.address ? { location: { address: job.clients.address } } : {}),
  }

  const result = await wwPost(cfg.baseUrl, cfg.apiKey,
    `/api/v1/territories/${cfg.territoryId}/orders`, order)

  await supabase.from('quotes').update({ workwave_synced_at: new Date().toISOString() }).eq('id', quoteId)
  await logSync(supabase, 'quote', quoteId, 'ok', { requestId: result?.requestId, payload: order })
  return { action: 'synced', requestId: result?.requestId }
}

async function syncCalendar(supabase: ReturnType<typeof createAdminClient>, cfg: { baseUrl: string; apiKey: string; territoryId: string }) {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, title, description, scheduled_date, clients(name, address, workwave_id), quotes(estimate)')
    .not('scheduled_date', 'is', null)
    .in('status', ['accepted', 'scheduled', 'in_progress'])

  if (!jobs?.length) return { action: 'synced', count: 0 }

  const results = []
  for (const job of jobs) {
    try {
      const r = await syncJob(supabase, job.id, cfg)
      results.push({ jobId: job.id, ...r })
    } catch (e) {
      await logSync(supabase, 'calendar', job.id, 'error', { error: String(e) })
      results.push({ jobId: job.id, error: String(e) })
    }
  }
  return { action: 'synced', count: results.length, results }
}

async function syncInvoice(supabase: ReturnType<typeof createAdminClient>, invoiceId: string, cfg: { baseUrl: string; apiKey: string; territoryId: string }) {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, jobs(title, clients(name, workwave_id))')
    .eq('id', invoiceId)
    .single()
  if (!invoice) throw new Error('Invoice not found')

  const job = invoice.jobs as { title: string; clients: { name: string; workwave_id: string | null } | null } | null

  const order = {
    name: `Invoice: ${job?.title ?? 'Service'} — $${invoice.amount}`,
    notes: `Invoice ${invoice.id.slice(0, 8)} | Status: ${invoice.status} | Due: ${invoice.due_date}`,
    companyCd: job?.clients?.workwave_id ?? null,
    customField1: `aloha-water-invoice-${invoiceId}`,
    loads: [{ type: 'revenue', size: Math.round(invoice.amount * 100) }],
  }

  const result = await wwPost(cfg.baseUrl, cfg.apiKey,
    `/api/v1/territories/${cfg.territoryId}/orders`, order)

  await logSync(supabase, 'invoice', invoiceId, 'ok', { requestId: result?.requestId, payload: order })
  return { action: 'synced', requestId: result?.requestId }
}

// ---- Main route handler ----

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { action, entity, entityId } = body

  // Load WorkWave config from settings
  const { data: settings } = await supabase.from('settings').select('workwave_api_key, workwave_territory_id, workwave_base_url').single()
  if (!settings?.workwave_api_key) return NextResponse.json({ error: 'WorkWave API key not configured.' }, { status: 400 })

  const cfg = {
    apiKey: settings.workwave_api_key,
    territoryId: settings.workwave_territory_id ?? '',
    baseUrl: (settings.workwave_base_url ?? 'https://wwrm.workwave.com').replace(/\/$/, ''),
  }

  try {
    let result

    if (action === 'test') {
      const data = await wwGet(cfg.baseUrl, cfg.apiKey, '/api/v1/territories')
      return NextResponse.json({ ok: true, territories: data })
    }

    if (action === 'sync_all') {
      const results: Record<string, unknown> = {}
      const [clients, jobs, invoices] = await Promise.all([
        supabase.from('clients').select('id'),
        supabase.from('jobs').select('id'),
        supabase.from('invoices').select('id'),
      ])
      for (const c of clients.data ?? []) {
        try { results[`client_${c.id}`] = await syncClient(supabase, c.id, cfg) }
        catch (e) { results[`client_${c.id}`] = { error: String(e) } }
      }
      for (const j of jobs.data ?? []) {
        try { results[`job_${j.id}`] = await syncJob(supabase, j.id, cfg) }
        catch (e) { results[`job_${j.id}`] = { error: String(e) } }
      }
      for (const i of invoices.data ?? []) {
        try { results[`invoice_${i.id}`] = await syncInvoice(supabase, i.id, cfg) }
        catch (e) { results[`invoice_${i.id}`] = { error: String(e) } }
      }
      results.calendar = await syncCalendar(supabase, cfg)
      return NextResponse.json({ ok: true, results })
    }

    switch (entity) {
      case 'client':   result = await syncClient(supabase, entityId, cfg); break
      case 'job':      result = await syncJob(supabase, entityId, cfg); break
      case 'quote':    result = await syncQuote(supabase, entityId, cfg); break
      case 'invoice':  result = await syncInvoice(supabase, entityId, cfg); break
      case 'calendar': result = await syncCalendar(supabase, cfg); break
      default: return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logSync(supabase, entity ?? 'unknown', entityId ?? null, 'error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return NextResponse.json({ logs: data ?? [] })
}
