import { NextRequest, NextResponse } from 'next/server'
import { createEvent } from '@/lib/google-calendar'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { jobId, startDateTime, endDateTime, clientName, clientEmail } = await req.json()

    const supabase = createAdminClient()
    const { data: job } = await supabase
      .from('jobs')
      .select('title, description, clients(name, email)')
      .eq('id', jobId)
      .single()

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const clientRow = job.clients as unknown
    const client = (Array.isArray(clientRow) ? clientRow[0] : clientRow) as { name: string; email: string } | null
    const eventSummary = `🔧 ${job.title}`
    const eventDescription = `Client: ${clientName || client?.name || 'Unknown'}\nJob: ${job.description}`

    const event = await createEvent({
      summary: eventSummary,
      description: eventDescription,
      startDateTime,
      endDateTime,
      attendeeEmail: clientEmail || client?.email,
    })

    if (!event.id) throw new Error('Calendar event creation failed')

    await supabase
      .from('jobs')
      .update({
        status: 'scheduled',
        scheduled_date: startDateTime,
        scheduled_end: endDateTime,
        google_event_id: event.id,
      })
      .eq('id', jobId)

    return NextResponse.json({ eventId: event.id })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
