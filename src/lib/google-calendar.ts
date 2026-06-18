import { createAdminClient } from './supabase/admin'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3'

export interface CalEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime: string }
  end: { dateTime: string }
  attendees?: { email: string }[]
}

export interface BusySlot {
  start: string
  end: string
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh Google token: ' + JSON.stringify(data))
  return data.access_token
}

async function getTokenAndCalendar(): Promise<{ token: string; calendarId: string }> {
  const supabase = createAdminClient()
  const { data } = await supabase.from('settings').select('google_refresh_token, google_calendar_id').single()
  if (!data?.google_refresh_token) throw new Error('Google Calendar not connected. Sign in as admin first.')
  const token = await refreshAccessToken(data.google_refresh_token)
  return { token, calendarId: data.google_calendar_id || 'primary' }
}

export async function setupCalendar(): Promise<string> {
  const supabase = createAdminClient()
  const { data: settings } = await supabase.from('settings').select('google_refresh_token, google_calendar_id').single()

  if (settings?.google_calendar_id) return settings.google_calendar_id
  if (!settings?.google_refresh_token) throw new Error('No refresh token stored.')

  const token = await refreshAccessToken(settings.google_refresh_token)

  const res = await fetch(`${API}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Trade-Smith Jobs', description: 'Plumbing job schedule' }),
  })
  const cal = await res.json()
  if (!cal.id) throw new Error('Failed to create calendar: ' + JSON.stringify(cal))

  await supabase.from('settings').update({ google_calendar_id: cal.id }).eq('id', 1)
  return cal.id
}

export async function listEvents(timeMin: string, timeMax: string): Promise<CalEvent[]> {
  const { token, calendarId } = await getTokenAndCalendar()
  const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime' })
  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  return (data.items || []).filter((e: CalEvent) => e.start?.dateTime)
}

export async function getFreeBusy(timeMin: string, timeMax: string): Promise<BusySlot[]> {
  const { token, calendarId } = await getTokenAndCalendar()
  const res = await fetch(`${API}/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  })
  const data = await res.json()
  return data.calendars?.[calendarId]?.busy || []
}

export async function createEvent(params: {
  summary: string
  description: string
  startDateTime: string
  endDateTime: string
  attendeeEmail?: string
}): Promise<CalEvent> {
  const { token, calendarId } = await getTokenAndCalendar()
  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: params.startDateTime },
    end: { dateTime: params.endDateTime },
  }
  if (params.attendeeEmail) body.attendees = [{ email: params.attendeeEmail }]

  const res = await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}
