import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---- OAuth helpers ----

const QB_SANDBOX = 'https://sandbox-quickbooks.api.intuit.com'
const QB_PROD    = 'https://quickbooks.api.intuit.com'
const QB_AUTH    = 'https://appcenter.intuit.com/connect/oauth2'
const QB_TOKEN   = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const SCOPES     = 'com.intuit.quickbooks.accounting'

function baseUrl(env: string) {
  return env === 'production' ? QB_PROD : QB_SANDBOX
}

async function refreshAccessToken(cfg: QBConfig): Promise<QBConfig> {
  const supabase = createAdminClient()
  const creds = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const res = await fetch(QB_TOKEN, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: cfg.refreshToken }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  const data = await res.json()
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  await supabase.from('settings').update({
    qb_access_token: data.access_token,
    qb_refresh_token: data.refresh_token ?? cfg.refreshToken,
    qb_token_expires_at: expiresAt,
  }).eq('id', 1)
  return { ...cfg, accessToken: data.access_token, refreshToken: data.refresh_token ?? cfg.refreshToken }
}

interface QBConfig {
  clientId: string
  clientSecret: string
  realmId: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: string | null
  environment: string
}

async function loadConfig(): Promise<QBConfig> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('settings').select('qb_client_id,qb_client_secret,qb_realm_id,qb_access_token,qb_refresh_token,qb_token_expires_at,qb_environment').single()
  if (!data?.qb_client_id) throw new Error('QuickBooks not configured')
  return {
    clientId: data.qb_client_id,
    clientSecret: data.qb_client_secret,
    realmId: data.qb_realm_id,
    accessToken: data.qb_access_token,
    refreshToken: data.qb_refresh_token,
    tokenExpiresAt: data.qb_token_expires_at,
    environment: data.qb_environment ?? 'sandbox',
  }
}

async function qbGet(cfg: QBConfig, path: string) {
  if (cfg.tokenExpiresAt && new Date(cfg.tokenExpiresAt) < new Date(Date.now() + 60000)) {
    cfg = await refreshAccessToken(cfg)
  }
  const res = await fetch(`${baseUrl(cfg.environment)}/v3/company/${cfg.realmId}${path}?minorversion=65`, {
    headers: { Authorization: `Bearer ${cfg.accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`QB GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function qbPost(cfg: QBConfig, path: string, body: unknown) {
  if (cfg.tokenExpiresAt && new Date(cfg.tokenExpiresAt) < new Date(Date.now() + 60000)) {
    cfg = await refreshAccessToken(cfg)
  }
  const res = await fetch(`${baseUrl(cfg.environment)}/v3/company/${cfg.realmId}${path}?minorversion=65`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`QB POST ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

// ---- Sync helpers ----

async function logSync(
  supabase: ReturnType<typeof createAdminClient>,
  entity_type: string, entity_id: string | null,
  status: 'ok' | 'error',
  opts: { error?: string; payload?: unknown } = {}
) {
  await supabase.from('sync_log').insert({
    entity_type, entity_id, status, source: 'quickbooks',
    error_message: opts.error ?? null,
    payload: opts.payload ?? null,
  })
}

// ---- Entity sync ----

async function syncClient(supabase: ReturnType<typeof createAdminClient>, clientId: string, cfg: QBConfig) {
  const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single()
  if (!client) throw new Error('Client not found')

  const customer = {
    DisplayName: client.name,
    PrimaryEmailAddr: client.email ? { Address: client.email } : undefined,
    PrimaryPhone: client.phone ? { FreeFormNumber: client.phone } : undefined,
    BillAddr: client.address ? { Line1: client.address } : undefined,
  }

  let result
  if (client.qb_customer_id) {
    // Sparse update — fetch current SyncToken first
    const current = await qbGet(cfg, `/customer/${client.qb_customer_id}`)
    result = await qbPost(cfg, '/customer', {
      ...customer,
      Id: client.qb_customer_id,
      SyncToken: current.Customer?.SyncToken ?? '0',
      sparse: true,
    })
  } else {
    result = await qbPost(cfg, '/customer', customer)
    const newId = result?.Customer?.Id ?? null
    if (newId) await supabase.from('clients').update({ qb_customer_id: newId }).eq('id', clientId)
  }

  await logSync(supabase, 'client', clientId, 'ok', { payload: customer })
  return { action: client.qb_customer_id ? 'updated' : 'created', qb_id: result?.Customer?.Id }
}

async function syncInvoice(supabase: ReturnType<typeof createAdminClient>, invoiceId: string, cfg: QBConfig) {
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*, jobs(title, description, clients(name, qb_customer_id))')
    .eq('id', invoiceId)
    .single()
  if (!invoice) throw new Error('Invoice not found')

  const job = invoice.jobs as { title: string; description: string; clients: { name: string; qb_customer_id: string | null } | null } | null
  const customerId = job?.clients?.qb_customer_id

  const qbInvoice = {
    Line: [{
      Amount: invoice.amount,
      DetailType: 'SalesItemLineDetail',
      Description: job?.title ?? 'Service',
      SalesItemLineDetail: {
        ItemRef: { value: '1', name: 'Services' },
        UnitPrice: invoice.amount,
        Qty: 1,
      },
    }],
    CustomerRef: customerId ? { value: customerId } : undefined,
    DueDate: invoice.due_date ?? undefined,
    DocNumber: invoice.id.slice(0, 8).toUpperCase(),
    PrivateNote: job?.description ?? undefined,
  }

  let result
  if (invoice.qb_invoice_id) {
    const current = await qbGet(cfg, `/invoice/${invoice.qb_invoice_id}`)
    result = await qbPost(cfg, '/invoice', {
      ...qbInvoice,
      Id: invoice.qb_invoice_id,
      SyncToken: current.Invoice?.SyncToken ?? '0',
      sparse: true,
    })
  } else {
    result = await qbPost(cfg, '/invoice', qbInvoice)
    const newId = result?.Invoice?.Id ?? null
    if (newId) {
      await supabase.from('invoices').update({ qb_invoice_id: newId, qb_synced_at: new Date().toISOString() }).eq('id', invoiceId)
    }
  }

  await logSync(supabase, 'invoice', invoiceId, 'ok', { payload: qbInvoice })
  return { action: invoice.qb_invoice_id ? 'updated' : 'created', qb_id: result?.Invoice?.Id }
}

async function syncAllClients(supabase: ReturnType<typeof createAdminClient>, cfg: QBConfig) {
  const { data: clients } = await supabase.from('clients').select('id')
  const results = []
  for (const c of clients ?? []) {
    try { results.push({ id: c.id, ...(await syncClient(supabase, c.id, cfg)) }) }
    catch (e) { await logSync(supabase, 'client', c.id, 'error', { error: String(e) }); results.push({ id: c.id, error: String(e) }) }
  }
  return { count: results.length, results }
}

async function syncAllInvoices(supabase: ReturnType<typeof createAdminClient>, cfg: QBConfig) {
  const { data: invoices } = await supabase.from('invoices').select('id')
  const results = []
  for (const i of invoices ?? []) {
    try { results.push({ id: i.id, ...(await syncInvoice(supabase, i.id, cfg)) }) }
    catch (e) { await logSync(supabase, 'invoice', i.id, 'error', { error: String(e) }); results.push({ id: i.id, error: String(e) }) }
  }
  return { count: results.length, results }
}

// ---- OAuth flow ----

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'logs') {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('sync_log')
      .select('*')
      .eq('source', 'quickbooks')
      .order('created_at', { ascending: false })
      .limit(50)
    return NextResponse.json({ logs: data ?? [] })
  }

  if (action === 'auth_url') {
    const supabase = createAdminClient()
    const { data: settings } = await supabase.from('settings').select('qb_client_id, qb_environment').single()
    if (!settings?.qb_client_id) return NextResponse.json({ error: 'Client ID not set' }, { status: 400 })

    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL}/api/integrations/quickbooks/callback`
    const params = new URLSearchParams({
      client_id: settings.qb_client_id,
      response_type: 'code',
      scope: SCOPES,
      redirect_uri: redirectUri,
      state: 'qb_oauth',
    })
    return NextResponse.json({ url: `${QB_AUTH}?${params}` })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const { action, entity, entityId } = body

  let cfg: QBConfig
  try {
    cfg = await loadConfig()
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 })
  }

  try {
    if (action === 'test') {
      const data = await qbGet(cfg, '/companyinfo/' + cfg.realmId)
      return NextResponse.json({ ok: true, company: data?.CompanyInfo })
    }

    if (action === 'sync_all') {
      const [clients, invoices] = await Promise.all([
        syncAllClients(supabase, cfg),
        syncAllInvoices(supabase, cfg),
      ])
      return NextResponse.json({ ok: true, clients, invoices })
    }

    let result
    if (entity === 'client')  result = entityId ? await syncClient(supabase, entityId, cfg) : await syncAllClients(supabase, cfg)
    else if (entity === 'invoice') result = entityId ? await syncInvoice(supabase, entityId, cfg) : await syncAllInvoices(supabase, cfg)
    else return NextResponse.json({ error: `Unknown entity: ${entity}` }, { status: 400 })

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logSync(supabase, entity ?? 'unknown', entityId ?? null, 'error', { error: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
