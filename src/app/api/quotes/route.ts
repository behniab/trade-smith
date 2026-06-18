import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { description, job_type, urgency, estimate, client: clientInfo } = await req.json()

    const supabase = await createAdminClient()

    // Upsert client by email
    let clientId: string
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('email', clientInfo.email)
      .single()

    if (existingClient) {
      clientId = existingClient.id
    } else {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({ name: clientInfo.name, email: clientInfo.email, phone: clientInfo.phone || null })
        .select('id')
        .single()
      if (error) throw error
      clientId = newClient.id
    }

    // Create job
    const title = job_type || description.slice(0, 80)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({ client_id: clientId, title, description, status: 'requested', urgency })
      .select('id')
      .single()
    if (jobError) throw jobError

    // Create quote
    const { error: quoteError } = await supabase
      .from('quotes')
      .insert({
        job_id: job.id,
        estimate,
        ai_prompt_summary: description.slice(0, 300),
        status: 'pending',
      })
    if (quoteError) throw quoteError

    return NextResponse.json({ job_id: job.id })
  } catch (err: unknown) {
    console.error('Quote submit error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to submit' },
      { status: 500 }
    )
  }
}
