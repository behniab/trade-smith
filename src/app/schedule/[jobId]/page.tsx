'use client'

import { useState, useEffect, use } from 'react'
import { Wrench, ChevronLeft, ChevronRight, Loader2, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface BusySlot { start: string; end: string }

const SLOT_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16] // 8am–4pm (2hr slots end by 6pm)
const SLOT_DURATION_HRS = 2

function fmt(d: Date) { return d.toISOString().split('T')[0] }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }

function isSlotBusy(date: Date, hour: number, busy: BusySlot[]) {
  const slotStart = new Date(date)
  slotStart.setHours(hour, 0, 0, 0)
  const slotEnd = new Date(slotStart)
  slotEnd.setHours(hour + SLOT_DURATION_HRS)
  return busy.some(b => {
    const bs = new Date(b.start), be = new Date(b.end)
    return slotStart < be && slotEnd > bs
  })
}

function isWeekday(d: Date) { return d.getDay() >= 1 && d.getDay() <= 5 }

function fmtSlot(date: Date, hour: number) {
  const start = new Date(date); start.setHours(hour, 0, 0, 0)
  const end = new Date(start); end.setHours(hour + SLOT_DURATION_HRS)
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }
  return `${start.toLocaleTimeString('en-US', opts)} – ${end.toLocaleTimeString('en-US', opts)}`
}

export default function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>
  searchParams: Promise<{ name?: string; email?: string }>
}) {
  const { jobId } = use(params)
  const { name: prefillName = '', email: prefillEmail = '' } = use(searchParams)

  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    // Start from tomorrow, find next Monday
    const tomorrow = addDays(today, 1)
    const daysUntilMon = (8 - tomorrow.getDay()) % 7 || 7
    const mon = addDays(tomorrow, tomorrow.getDay() === 1 ? 0 : daysUntilMon - 7 + (tomorrow.getDay() === 0 ? 1 : 0))
    // Simpler: just start from tomorrow if it's a weekday, else next Monday
    if (isWeekday(tomorrow)) return tomorrow
    const d = new Date(tomorrow); while (!isWeekday(d)) d.setDate(d.getDate() + 1); return d
  })

  const [busy, setBusy] = useState<BusySlot[]>([])
  const [loadingBusy, setLoadingBusy] = useState(false)
  const [selected, setSelected] = useState<{ date: Date; hour: number } | null>(null)
  const [clientInfo, setClientInfo] = useState({ name: prefillName, email: prefillEmail, phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  // 5 weekdays starting from weekStart
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(isWeekday).slice(0, 5)
  const weekEnd = addDays(days[days.length - 1], 1)

  useEffect(() => {
    setLoadingBusy(true)
    const start = new Date(weekStart); start.setHours(0, 0, 0, 0)
    fetch(`/api/calendar/freebusy?start=${start.toISOString()}&end=${weekEnd.toISOString()}`)
      .then(r => r.json())
      .then(d => { setBusy(d.busy || []); setLoadingBusy(false) })
      .catch(() => setLoadingBusy(false))
  }, [weekStart])

  function prevWeek() { setWeekStart(d => addDays(d, -7)); setSelected(null) }
  function nextWeek() { setWeekStart(d => addDays(d, 7)); setSelected(null) }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true); setError('')
    const startDT = new Date(selected.date); startDT.setHours(selected.hour, 0, 0, 0)
    const endDT = new Date(startDT); endDT.setHours(selected.hour + SLOT_DURATION_HRS)
    try {
      const res = await fetch('/api/calendar/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          startDateTime: startDT.toISOString(),
          endDateTime: endDT.toISOString(),
          clientName: clientInfo.name,
          clientEmail: clientInfo.email,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to schedule')
      setDone(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-12 max-w-md w-full text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re booked!</h2>
          <p className="text-gray-500 mb-2">
            Your appointment has been confirmed for{' '}
            <strong>{selected && new Date(selected.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong>
            {selected && ` at ${fmtSlot(selected.date, selected.hour)}`}.
          </p>
          <p className="text-sm text-gray-400 mb-8">You&apos;ll receive a confirmation email shortly.</p>
          <Link href="/" className="text-blue-600 font-medium hover:underline">Back to home</Link>
        </div>
      </div>
    )
  }

  const weekLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-blue-600">
          <Wrench className="w-5 h-5" /> Trade-Smith
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600 text-sm">Schedule Repair</span>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Pick a time</h1>
        <p className="text-gray-500 text-sm mb-8">Select an available 2-hour window for your repair.</p>

        {/* Week navigator */}
        <div className="bg-white rounded-xl border overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <button onClick={prevWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm font-semibold text-gray-700">{weekLabel}</span>
            <button onClick={nextWeek} className="p-1 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {loadingBusy ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : (
            <div className="grid grid-cols-5 divide-x">
              {days.map((day, di) => (
                <div key={di} className="p-3">
                  <div className="text-center mb-3">
                    <div className="text-xs text-gray-500 font-medium">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold text-gray-900">{day.getDate()}</div>
                  </div>
                  <div className="space-y-1.5">
                    {SLOT_HOURS.map(hour => {
                      const busy_ = isSlotBusy(day, hour, busy)
                      const isPast = new Date(day) < new Date() && hour < new Date().getHours()
                      const isSelected = selected?.hour === hour && fmt(selected.date) === fmt(day)
                      if (busy_ || isPast) {
                        return (
                          <div key={hour} className="text-xs text-center py-1.5 rounded bg-gray-100 text-gray-400 cursor-not-allowed">
                            {hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                          </div>
                        )
                      }
                      return (
                        <button
                          key={hour}
                          onClick={() => setSelected({ date: day, hour })}
                          className={`w-full text-xs text-center py-1.5 rounded font-medium transition ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirm booking */}
        {selected && (
          <form onSubmit={handleBook} className="bg-white rounded-xl border p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Confirm your appointment</h3>
              <p className="text-sm text-blue-600 font-medium">
                {selected.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {fmtSlot(selected.date, selected.hour)}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder="Your name" value={clientInfo.name}
                onChange={e => setClientInfo(p => ({ ...p, name: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <input required type="email" placeholder="Email address" value={clientInfo.email}
                onChange={e => setClientInfo(p => ({ ...p, email: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</> : 'Confirm Booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
