import { NextResponse } from 'next/server'
import { setupCalendar } from '@/lib/google-calendar'

export async function POST() {
  try {
    const calendarId = await setupCalendar()
    return NextResponse.json({ calendarId })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Setup failed' }, { status: 500 })
  }
}
