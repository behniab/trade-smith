'use client'

import { useState, useEffect } from 'react'
import {
  ChevronDown, ChevronUp, Loader2, Star, AlertTriangle,
  CheckCircle, Clock, User, Phone, Mail, MapPin, Wrench,
  DollarSign, Calendar, FileText, Tag, Brain, TrendingUp, TrendingDown, Minus
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS } from '@/lib/utils'

// ---- Types ----
interface Feedback {
  id: string
  accuracy_rating: number
  actual_total: number
  actual_labor_cost: number | null
  actual_parts_cost: number | null
  variance_amount: number
  variance_reason: string | null
  admin_notes: string | null
  ai_learning_summary: string | null
  tags: string[]
}

interface Invoice {
  id: string; amount: number; status: string; due_date: string; paid_at: string | null
}

interface Quote {
  id: string
  estimate: { total: number; labor_cost: number; parts_cost: number; labor_hours: number; summary: string; confidence: string }
  status: string
  created_at: string
}

interface Job {
  id: string; title: string; description: string; status: string; urgency: string
  scheduled_date: string | null; completed_at: string | null; actual_total: number | null
  created_at: string
  quotes: Quote[]
  invoices: Invoice[]
  quote_feedback: Feedback[]
}

interface Client {
  id: string; name: string; email: string; phone: string | null
  address: string | null; notes: string | null; created_at: string
  jobs: Job[]
}

// ---- Constants ----
const VARIANCE_TAGS = [
  'underestimated_labor', 'overestimated_labor',
  'unexpected_parts', 'fewer_parts_needed',
  'hidden_damage', 'scope_change',
  'access_difficulty', 'code_compliance',
  'material_cost_increase', 'faster_than_expected',
]

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Way off', color: 'text-red-400' },
  2: { label: 'Off', color: 'text-orange-400' },
  3: { label: 'Close', color: 'text-yellow-400' },
  4: { label: 'Good', color: 'text-blue-400' },
  5: { label: 'Spot-on', color: 'text-green-400' },
}

// ---- Sub-components ----

function RatingStars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n} type="button"
          onClick={() => onChange?.(n)}
          className={`transition ${onChange ? 'hover:scale-110 cursor-pointer' : 'cursor-default'} ${n <= value ? 'text-yellow-400' : 'text-gray-700'}`}
        >
          <Star className="w-5 h-5 fill-current" />
        </button>
      ))}
      {value > 0 && (
        <span className={`ml-2 text-xs font-medium ${RATING_LABELS[value]?.color}`}>
          {RATING_LABELS[value]?.label}
        </span>
      )}
    </div>
  )
}

function VarianceTag({ tag, selected, onClick }: { tag: string; selected: boolean; onClick: () => void }) {
  const label = tag.replace(/_/g, ' ')
  return (
    <button type="button" onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${selected
        ? 'bg-blue-500/20 border-blue-500 text-blue-300'
        : 'border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-400'
      }`}>
      {label}
    </button>
  )
}

function FeedbackForm({ job, quote, onSaved }: { job: Job; quote: Quote | null; onSaved: (fb: Feedback) => void }) {
  const existing = job.quote_feedback?.[0] ?? null
  const [rating, setRating] = useState(existing?.accuracy_rating ?? 0)
  const [actualLabor, setActualLabor] = useState(existing?.actual_labor_cost?.toString() ?? '')
  const [actualParts, setActualParts] = useState(existing?.actual_parts_cost?.toString() ?? '')
  const [reason, setReason] = useState(existing?.variance_reason ?? '')
  const [notes, setNotes] = useState(existing?.admin_notes ?? '')
  const [tags, setTags] = useState<string[]>(existing?.tags ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!existing)
  const [learning, setLearning] = useState<string | null>(existing?.ai_learning_summary ?? null)

  const actualTotal = (parseFloat(actualLabor) || 0) + (parseFloat(actualParts) || 0)
  const estimated = quote?.estimate?.total ?? 0
  const variance = actualTotal - estimated

  function toggleTag(t: string) {
    setTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) return
    setSaving(true)
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: job.id,
        quote_id: quote?.id ?? null,
        accuracy_rating: rating,
        estimated_total: estimated,
        actual_labor_cost: parseFloat(actualLabor) || null,
        actual_parts_cost: parseFloat(actualParts) || null,
        actual_total: actualTotal || estimated,
        variance_reason: reason || null,
        admin_notes: notes || null,
        tags,
        job_description: job.description,
        job_type: job.title,
        estimate: quote?.estimate ?? null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.feedback) {
      setSaved(true)
      setLearning(data.feedback.ai_learning_summary)
      onSaved(data.feedback)
    }
  }

  const inputCls = 'w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quote Accuracy</label>
        <RatingStars value={rating} onChange={v => { setRating(v); setSaved(false) }} />
      </div>

      {/* Actuals */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Actual Labor ($)</label>
          <input type="number" min="0" step="0.01" value={actualLabor}
            onChange={e => { setActualLabor(e.target.value); setSaved(false) }}
            placeholder={quote?.estimate?.labor_cost?.toFixed(2) ?? '0.00'} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Actual Parts ($)</label>
          <input type="number" min="0" step="0.01" value={actualParts}
            onChange={e => { setActualParts(e.target.value); setSaved(false) }}
            placeholder={quote?.estimate?.parts_cost?.toFixed(2) ?? '0.00'} className={inputCls} />
        </div>
      </div>

      {/* Variance display */}
      {(actualLabor || actualParts) && estimated > 0 && (
        <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
          Math.abs(variance) < 20 ? 'bg-green-500/10 border-green-500/20 text-green-300'
          : variance > 0 ? 'bg-red-500/10 border-red-500/20 text-red-300'
          : 'bg-blue-500/10 border-blue-500/20 text-blue-300'
        }`}>
          {variance > 0 ? <TrendingUp className="w-4 h-4 shrink-0" /> : variance < 0 ? <TrendingDown className="w-4 h-4 shrink-0" /> : <Minus className="w-4 h-4 shrink-0" />}
          <span>
            Actual {formatCurrency(actualTotal)} vs estimated {formatCurrency(estimated)}
            {' '}— {variance === 0 ? 'exact match' : `${variance > 0 ? '+' : ''}${formatCurrency(variance)} (${((variance / estimated) * 100).toFixed(1)}%)`}
          </span>
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What caused the variance?</label>
        <div className="flex flex-wrap gap-2">
          {VARIANCE_TAGS.map(t => (
            <VarianceTag key={t} tag={t} selected={tags.includes(t)} onClick={() => toggleTag(t)} />
          ))}
        </div>
      </div>

      {/* Reason + notes */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Short explanation</label>
        <input value={reason} onChange={e => { setReason(e.target.value); setSaved(false) }}
          placeholder="e.g. Found corroded pipe behind wall, added 1.5 hours"
          className={inputCls} />
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Additional notes</label>
        <textarea rows={2} value={notes} onChange={e => { setNotes(e.target.value); setSaved(false) }}
          placeholder="Anything else worth noting for future reference…"
          className={inputCls + ' resize-none'} />
      </div>

      <button type="submit" disabled={saving || !rating}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving & analyzing…</> : saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : 'Save Feedback'}
      </button>

      {/* AI Learning summary */}
      {learning && (
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <p className="text-xs font-semibold text-purple-300 uppercase tracking-wide">What the app learned</p>
          </div>
          <p className="text-sm text-purple-100/80 leading-relaxed">{learning}</p>
          <p className="text-xs text-purple-400/60 mt-2">This insight will be applied to future estimates for similar jobs.</p>
        </div>
      )}
    </form>
  )
}

function JobRow({ job, clientName }: { job: Job; clientName: string }) {
  const [open, setOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [jobData, setJobData] = useState(job)

  const quote = jobData.quotes?.[0] ?? null
  const invoice = jobData.invoices?.[0] ?? null
  const feedback = jobData.quote_feedback?.[0] ?? null

  const statusColor = JOB_STATUS_COLORS[jobData.status] ?? 'bg-gray-100 text-gray-600'

  function onFeedbackSaved(fb: Feedback) {
    setJobData(p => ({ ...p, quote_feedback: [fb] }))
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Job summary row */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{jobData.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
              {JOB_STATUS_LABELS[jobData.status]}
            </span>
            {jobData.urgency !== 'standard' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${jobData.urgency === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                {jobData.urgency}
              </span>
            )}
            {feedback && <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />}
          </div>
          <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(jobData.created_at).toLocaleDateString()}</span>
            {quote && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />Est. {formatCurrency(quote.estimate.total)}</span>}
            {invoice && <span className={`flex items-center gap-1 font-medium ${invoice.status === 'paid' ? 'text-green-500' : 'text-orange-400'}`}>
              <FileText className="w-3 h-3" />{invoice.status}
            </span>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {/* Expanded job detail */}
      {open && (
        <div className="bg-gray-50 border-t px-4 py-4 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700 leading-relaxed">{jobData.description}</p>
          </div>

          {/* Timeline */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Requested', value: new Date(jobData.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) },
              { label: 'Scheduled', value: jobData.scheduled_date ? new Date(jobData.scheduled_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—' },
              { label: 'Completed', value: jobData.completed_at ? new Date(jobData.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—' },
              { label: 'Client', value: clientName },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-lg border px-3 py-2">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Quote estimate */}
          {quote && (
            <div className="bg-white rounded-lg border p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Original Quote</p>
              <p className="text-xs text-gray-600 mb-2 italic">{quote.estimate.summary}</p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-gray-400">Labor ({quote.estimate.labor_hours}h)</p><p className="font-medium text-gray-800">{formatCurrency(quote.estimate.labor_cost)}</p></div>
                <div><p className="text-xs text-gray-400">Parts</p><p className="font-medium text-gray-800">{formatCurrency(quote.estimate.parts_cost)}</p></div>
                <div><p className="text-xs text-gray-400">Total</p><p className="font-bold text-gray-900">{formatCurrency(quote.estimate.total)}</p></div>
              </div>
              <p className="text-xs text-gray-400 mt-2 capitalize">Confidence: <span className={`font-medium ${quote.estimate.confidence === 'high' ? 'text-green-600' : quote.estimate.confidence === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>{quote.estimate.confidence}</span></p>
            </div>
          )}

          {/* Invoice */}
          {invoice && (
            <div className="bg-white rounded-lg border p-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invoice</p>
              <div className="flex items-center justify-between">
                <div className="grid grid-cols-3 gap-4 text-sm flex-1">
                  <div><p className="text-xs text-gray-400">Amount</p><p className="font-bold text-gray-900">{formatCurrency(invoice.amount)}</p></div>
                  <div><p className="text-xs text-gray-400">Due</p><p className="font-medium text-gray-800">{new Date(invoice.due_date).toLocaleDateString()}</p></div>
                  <div><p className="text-xs text-gray-400">Status</p>
                    <p className={`font-medium capitalize ${invoice.status === 'paid' ? 'text-green-600' : invoice.status === 'overdue' ? 'text-red-600' : 'text-orange-500'}`}>
                      {invoice.status}{invoice.paid_at ? ` · ${new Date(invoice.paid_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback */}
          {feedback && !feedbackOpen && (
            <div className="bg-white rounded-lg border p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quote Feedback</p>
                <button onClick={() => setFeedbackOpen(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
              <RatingStars value={feedback.accuracy_rating} />
              {feedback.variance_amount != null && (
                <p className="text-xs text-gray-500 mt-1">
                  Variance: {feedback.variance_amount > 0 ? '+' : ''}{formatCurrency(feedback.variance_amount)}
                </p>
              )}
              {feedback.ai_learning_summary && (
                <div className="mt-3 bg-purple-50 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Brain className="w-3.5 h-3.5 text-purple-500" />
                    <p className="text-xs font-semibold text-purple-600">App learning</p>
                  </div>
                  <p className="text-xs text-purple-700 leading-relaxed">{feedback.ai_learning_summary}</p>
                </div>
              )}
              {feedback.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {feedback.tags.map(t => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {(feedbackOpen || !feedback) && (
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Tag className="w-4 h-4 text-blue-400" />
                <p className="text-sm font-semibold text-white">
                  {feedback ? 'Update Quote Feedback' : 'Rate This Quote'}
                </p>
              </div>
              <FeedbackForm job={jobData} quote={quote} onSaved={fb => { onFeedbackSaved(fb); setFeedbackOpen(false) }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ClientCard({ client }: { client: Client }) {
  const [open, setOpen] = useState(false)
  const totalSpend = client.jobs.reduce((sum, j) => {
    const inv = j.invoices?.[0]
    return sum + (inv?.amount ?? j.quotes?.[0]?.estimate?.total ?? 0)
  }, 0)
  const paidCount = client.jobs.filter(j => j.invoices?.[0]?.status === 'paid').length

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition text-left"
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-blue-700 font-bold text-sm">{client.name.charAt(0).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{client.name}</p>
          <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
            {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
            {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
          </div>
        </div>
        <div className="text-right shrink-0 hidden sm:block">
          <p className="text-sm font-semibold text-gray-900">{formatCurrency(totalSpend)}</p>
          <p className="text-xs text-gray-400">{client.jobs.length} job{client.jobs.length !== 1 ? 's' : ''} · {paidCount} paid</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Client details strip */}
          <div className="px-5 py-3 bg-gray-50 border-b flex flex-wrap gap-4 text-xs text-gray-500">
            {client.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{client.address}</span>}
            <span className="flex items-center gap-1"><User className="w-3 h-3" />Client since {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
            {client.notes && <span className="flex items-center gap-1 italic"><FileText className="w-3 h-3" />{client.notes}</span>}
          </div>

          {/* Jobs */}
          {client.jobs.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">No jobs yet.</p>
          ) : (
            client.jobs.map(job => (
              <JobRow key={job.id} job={job} clientName={client.name} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ---- Learnings panel ----
function LearningsPanel() {
  const [feedback, setFeedback] = useState<Array<{ id: string; ai_learning_summary: string; jobs: { title: string } | null; accuracy_rating: number; created_at: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/feedback').then(r => r.json()).then(d => {
      setFeedback((d.feedback ?? []).filter((f: { ai_learning_summary: string | null }) => f.ai_learning_summary))
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center gap-2 text-gray-400 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading learnings…</div>
  if (feedback.length === 0) return (
    <div className="text-center py-8 text-gray-400 text-sm">
      <Brain className="w-8 h-8 mx-auto mb-2 text-gray-300" />
      No learnings yet — submit quote feedback on completed jobs to start building insights.
    </div>
  )

  return (
    <div className="space-y-3">
      {feedback.map(f => (
        <div key={f.id} className="bg-purple-50 border border-purple-100 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4 mb-2">
            <p className="text-xs font-semibold text-purple-600">{f.jobs?.title ?? 'Job'}</p>
            <div className="flex items-center gap-1 shrink-0">
              {[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= f.accuracy_rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}
            </div>
          </div>
          <p className="text-sm text-purple-800 leading-relaxed">{f.ai_learning_summary}</p>
          <p className="text-xs text-purple-400 mt-2">{new Date(f.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  )
}

// ---- Main page ----
export default function InvoicesPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'clients' | 'learnings'>('clients')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => {
      setClients(d.clients ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = clients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.jobs.some(j => j.title.toLowerCase().includes(search.toLowerCase()))
  )

  const totalJobs = clients.reduce((s, c) => s + c.jobs.length, 0)
  const totalRevenue = clients.reduce((s, c) =>
    s + c.jobs.reduce((js, j) => js + (j.invoices?.[0]?.amount ?? j.quotes?.[0]?.estimate?.total ?? 0), 0), 0)
  const feedbackCount = clients.reduce((s, c) =>
    s + c.jobs.filter(j => j.quote_feedback?.length > 0).length, 0)

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clients & Jobs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Full history, quote accuracy feedback, and AI-driven learnings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Clients', value: clients.length, icon: User, color: 'text-blue-600 bg-blue-50' },
          { label: 'Total Jobs', value: totalJobs, icon: Wrench, color: 'text-purple-600 bg-purple-50' },
          { label: 'Est. Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-green-600 bg-green-50' },
          { label: 'Feedback Logged', value: feedbackCount, icon: Brain, color: 'text-orange-600 bg-orange-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4">
            <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-5">
        {(['clients', 'learnings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition -mb-px ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'learnings' ? '🧠 AI Learnings' : 'Clients & Jobs'}
          </button>
        ))}
      </div>

      {tab === 'learnings' ? (
        <LearningsPanel />
      ) : (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search clients or jobs…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-sm"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading clients…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border rounded-xl bg-white">
              <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">{search ? 'No results found.' : 'No clients yet.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(client => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
