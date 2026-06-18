import { NextRequest, NextResponse } from 'next/server'
import { listEvents } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

  try {
    const events = await listEvents(start, end)
    return NextResponse.json({ events })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
