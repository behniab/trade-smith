'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils'
import { CalEvent } from '@/lib/google-calendar'

const HOURS = Array.from({ length: 11 }, (_, i) => i + 7) // 7am–5pm
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function startOfWeek(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function fmt(d: Date) { return d.toISOString().split('T')[0] }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

interface Job {
  id: string
  title: string
  status: string
  urgency: string
  scheduled_date: string | null
  created_at: string
  clients: { name: string; email: string } | null
  quotes: { estimate: { total: number } }[] | null
}

export default function AdminJobsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState<CalEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const setupDone = useRef(false)

  // weekStart timestamp used as a stable primitive dependency
  const weekStartTs = weekStart.getTime()

  async function loadCalendar(weekTs: number) {
    // One-time calendar setup
    if (!setupDone.current) {
      try {
        const setupRes = await fetch('/api/calendar/setup', { method: 'POST' })
        if (!setupRes.ok) {
          const body = await setupRes.json().catch(() => ({}))
          setEventsError(body.error || `Calendar setup failed (HTTP ${setupRes.status}). Sign out and sign in again.`)
          setEventsLoading(false)
          return
        }
        setupDone.current = true
      } catch {
        setEventsError('Could not reach the server. Check your connection and try again.')
        setEventsLoading(false)
        return
      }
    }

    setEventsLoading(true)
    setEventsError('')

    const start = new Date(weekTs)
    const end = new Date(weekTs)
    end.setDate(end.getDate() + 7)

    try {
      const res = await fetch(`/api/calendar/events?start=${start.toISOString()}&end=${end.toISOString()}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setEvents(data.events)
    } catch (err: unknown) {
      setEventsError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setEventsLoading(false)
    }
  }

  useEffect(() => {
    loadCalendar(weekStartTs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStartTs])

  useEffect(() => {
    fetch('/api/jobs')
      .then(r => r.json())
      .then(d => { if (d.jobs) setJobs(d.jobs) })
  }, [])

  function prevWeek() { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  function nextWeek() { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  // Map events to day columns
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  function eventsOnDay(day: Date) {
    return events.filter(e => {
      const eDate = new Date(e.start.dateTime)
      return fmt(eDate) === fmt(day)
    })
  }

  function eventTop(e: CalEvent) {
    const start = new Date(e.start.dateTime)
    const hour = start.getHours() + start.getMinutes() / 60
    return Math.max(0, (hour - 7) * 56)
  }

  function eventHeight(e: CalEvent) {
    const start = new Date(e.start.dateTime)
    const end = new Date(e.end.dateTime)
    const dur = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    return Math.max(28, dur * 56)
  }

  const weekEndDisplay = new Date(weekStartTs + 6 * 86400000)
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEndDisplay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs & Calendar</h1>
        <Link href="/request-quote" target="_blank" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
          New quote request <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl border mb-8">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <button onClick={prevWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5" /></button>
          <span className="font-semibold text-sm text-gray-700">{weekLabel}</span>
          <button onClick={nextWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5" /></button>
        </div>

        {eventsError && (
          <div className="flex items-center justify-between gap-4 bg-red-50 px-4 py-2">
            <p className="text-sm text-red-600">{eventsError}</p>
            <button
              onClick={() => { setupDone.current = false; loadCalendar(weekStartTs) }}
              className="shrink-0 text-xs text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b">
              <div />
              {days.map((d, i) => {
                const isToday = fmt(d) === fmt(new Date())
                return (
                  <div key={i} className="text-center py-2 text-xs font-medium text-gray-500">
                    <div>{DAYS[d.getDay()]}</div>
                    <div className={`text-lg font-bold mt-0.5 w-8 h-8 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-900'}`}>
                      {d.getDate()}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Time grid */}
            <div className="grid grid-cols-[56px_repeat(7,1fr)] relative" style={{ height: `${HOURS.length * 56}px` }}>
              {/* Hour labels */}
              <div className="relative">
                {HOURS.map(h => (
                  <div key={h} className="absolute right-2 text-xs text-gray-400" style={{ top: `${(h - 7) * 56 - 8}px` }}>
                    {h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {days.map((day, di) => (
                <div key={di} className="relative border-l">
                  {HOURS.map(h => (
                    <div key={h} className="border-t border-gray-100" style={{ height: '56px' }} />
                  ))}
                  {eventsLoading ? null : eventsOnDay(day).map(e => (
                    <div
                      key={e.id}
                      className="absolute left-0.5 right-0.5 bg-blue-500 text-white rounded text-xs px-1 py-0.5 overflow-hidden cursor-default"
                      style={{ top: `${eventTop(e)}px`, height: `${eventHeight(e)}px` }}
                      title={`${e.summary}\n${fmtTime(e.start.dateTime)} – ${fmtTime(e.end.dateTime)}`}
                    >
                      <div className="font-medium truncate">{e.summary}</div>
                      <div className="opacity-80 truncate">{fmtTime(e.start.dateTime)}</div>
                    </div>
                  ))}
                </div>
              ))}

              {eventsLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 col-span-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Jobs list */}
      <div className="bg-white rounded-xl border">
        <div className="px-6 py-4 border-b font-semibold text-gray-900">All Jobs</div>
        <div className="divide-y">
          {jobs.length === 0 && (
            <p className="px-6 py-8 text-sm text-gray-400 text-center">No jobs yet.</p>
          )}
          {jobs.map(job => (
            <div key={job.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                <p className="text-xs text-gray-500">{job.clients?.name} · {new Date(job.created_at).toLocaleDateString()}</p>
                {job.scheduled_date && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    Scheduled: {new Date(job.scheduled_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {job.quotes?.[0] && (
                  <span className="text-sm font-medium text-gray-700">{formatCurrency(job.quotes[0].estimate.total)}</span>
                )}
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
