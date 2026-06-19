'use client'

import { useState } from 'react'
import { Wrench, Upload, Loader2, AlertTriangle, Zap, CalendarCheck, ArrowRight, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { QuoteEstimate, UrgencyLevel, ClarifyingQuestion, PartsListData } from '@/types'
import { formatCurrency } from '@/lib/utils'

const JOB_CATEGORIES: { label: string; jobs: string[]; highlight?: boolean; description?: string }[] = [
  {
    label: 'Certified Water Specialist',
    highlight: true,
    jobs: [
      'Water quality assessment',
      'Water softener installation',
      'Water softener repair / recharge',
      'Reverse osmosis system install',
      'Whole-house water filtration',
      'Iron / sulfur filtration system',
      'UV water purification install',
      'Water hardness testing & treatment',
      'Scale & mineral buildup removal',
      'Water treatment system maintenance',
      'Bottle-less water cooler installation',
    ],
  },
  {
    label: '5 Gallon Bottled Water',
    description: 'Delivery fee: $3.99 per stop',
    jobs: [
      'Purified water — 5 gallon delivery',
      'Aloha Plus — 5 gallon delivery (micro-clustered alkaline)',
      'Distilled water — 5 gallon delivery',
      'Hot & Cold cooler rental',
      'Room temp & Cold cooler rental',
    ],
  },
  {
    label: 'Single-Use / Paper Cartons',
    description: '500ml paper cartons',
    jobs: [
      'Purified water — 500ml cartons',
      'Aloha Plus — 500ml cartons (micro-clustered alkaline)',
      'Distilled water — 500ml cartons',
    ],
  },
  {
    label: 'Other',
    jobs: ['Other / Describe below'],
  },
]

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; desc: string; icon: React.ReactNode; accent: string; activeClass: string }[] = [
  { value: 'standard', label: 'Standard', desc: 'Within a few days', icon: <Wrench className="w-4 h-4" />, accent: 'text-blue-400', activeClass: 'border-blue-500 bg-blue-500/10 text-blue-300' },
  { value: 'urgent', label: 'Urgent', desc: 'Within 24 hours', icon: <AlertTriangle className="w-4 h-4" />, accent: 'text-orange-400', activeClass: 'border-orange-500 bg-orange-500/10 text-orange-300' },
  { value: 'emergency', label: 'Emergency', desc: 'Right now', icon: <Zap className="w-4 h-4" />, accent: 'text-red-400', activeClass: 'border-red-500 bg-red-500/10 text-red-300' },
]

function parseNoteItems(notes: string): { preamble: string; items: string[] } {
  const normalised = notes
    .replace(/\((\d+)\)\s*/g, '$1. ')
    .replace(/\b(\d+)\)\s*/g, '$1. ')

  const byLine = normalised.split(/\n+/)
  const lineItems = byLine.map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)

  if (byLine.some(l => /^\d+\.\s/.test(l.trim())) && lineItems.length > 1) {
    const firstNumbered = byLine.findIndex(l => /^\d+\.\s/.test(l.trim()))
    const preamble = byLine.slice(0, firstNumbered).join(' ').trim()
    const items = byLine.slice(firstNumbered).map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean)
    return { preamble, items }
  }

  const colonSplit = normalised.match(/^(.*?[:\.])\s*(1\.\s.+)$/s)
  const searchText = colonSplit ? colonSplit[2] : normalised
  const preamble = colonSplit ? colonSplit[1].replace(/[:\.]$/, '').trim() : ''
  const inlineMatches = [...searchText.matchAll(/\d+\.\s+(.+?)(?=\s+\d+\.\s|$)/gs)]
  if (inlineMatches.length > 1) return { preamble, items: inlineMatches.map(m => m[1].trim()) }

  return { preamble: '', items: [] }
}

function EstimateNotes({ notes }: { notes: string }) {
  const { preamble, items } = parseNoteItems(notes)
  if (items.length > 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</p>
        {preamble && <p className="text-xs text-gray-400 leading-relaxed">{preamble}</p>}
        <ol className="space-y-0">
          {items.map((item, i) => (
            <li key={i} className={`flex gap-3 text-xs text-gray-300 py-2 ${i < items.length - 1 ? 'border-b border-white/5' : ''}`}>
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[10px] mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{item}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Notes</p>
      <p className="text-xs text-gray-400 leading-relaxed">{notes}</p>
    </div>
  )
}

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition'

export default function RequestQuotePage() {
  const [jobType, setJobType] = useState('')
  const [description, setDescription] = useState('')
  const [urgency, setUrgency] = useState<UrgencyLevel>('standard')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [estimate, setEstimate] = useState<QuoteEstimate | null>(null)
  const [clientInfo, setClientInfo] = useState({ name: '', email: '', phone: '' })
  const [submitted, setSubmitted] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ClarifyingQuestion[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [partsList, setPartsList] = useState<PartsListData | null>(null)

  async function submitEstimateRequest(extraAnswers?: Record<string, string>) {
    setError('')
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('description', description)
      formData.append('job_type', jobType)
      formData.append('urgency', urgency)
      files.forEach(f => formData.append('media', f))
      if (extraAnswers && Object.keys(extraAnswers).length > 0) {
        formData.append('answers', JSON.stringify(Object.entries(extraAnswers).map(([id, answer]) => ({ id, answer }))))
      }
      const res = await fetch('/api/quotes/estimate', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate estimate')
      if (data.questions) {
        setQuestions(data.questions)
        setAnswers({})
      } else {
        setEstimate(data.estimate)
        setPartsList(data.parts_list ?? null)
        setQuestions(null)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleGetEstimate(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim() && !jobType) { setError('Please select a job type or describe your job.'); return }
    await submitEstimateRequest()
  }

  async function handleAnswersSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitEstimateRequest(answers)
  }

  async function handleBookJob(e: React.FormEvent) {
    e.preventDefault()
    if (!estimate) return
    setLoading(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, job_type: jobType, urgency, estimate, parts_list: partsList, client: clientInfo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit')
      setJobId(data.job_id)
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-green-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-12 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Request Submitted!</h2>
          <p className="text-gray-400 mb-8">Your quote has been received. Book a time slot or we&apos;ll be in touch shortly.</p>
          <div className="flex flex-col gap-3">
            {jobId && (
              <Link
                href={`/schedule/${jobId}?name=${encodeURIComponent(clientInfo.name)}&email=${encodeURIComponent(clientInfo.email)}`}
                className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-6 py-3 rounded-xl font-semibold transition shadow-lg shadow-blue-500/20"
              >
                <CalendarCheck className="w-5 h-5" />
                Schedule Repair Now
              </Link>
            )}
            <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm transition">Back to home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 px-6 py-4 flex items-center gap-3 backdrop-blur-md bg-gray-950/80 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5 font-bold text-lg">
          <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
            <Wrench className="w-3.5 h-3.5 text-white" />
          </div>
          <span>Aloha Water Company, Inc.</span>
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-gray-500 text-sm">Request a Quote</span>
      </nav>

      <div className="relative max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Get an Instant Quote</h1>
          <p className="text-gray-500">Describe your job and we&apos;ll generate a detailed cost estimate in seconds.</p>
        </div>

        {/* Clarifying questions step */}
        {questions && !estimate ? (
          <form onSubmit={handleAnswersSubmit} className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-5 py-4 mb-2">
              <p className="text-sm font-semibold text-blue-300 mb-0.5">A few quick questions</p>
              <p className="text-xs text-blue-400/70">Your answers help us give you a more accurate estimate.</p>
            </div>

            {questions.map((q, i) => (
              <div key={q.id} className="bg-gray-900 border border-white/10 rounded-xl p-5 space-y-3">
                <p className="text-sm font-semibold text-white">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px] font-bold mr-2">{i + 1}</span>
                  {q.question}
                </p>
                {q.type === 'single_choice' && q.options ? (
                  <div className="grid grid-cols-1 gap-2">
                    {q.options.map(opt => (
                      <label key={opt} className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition text-sm ${
                        answers[q.id] === opt
                          ? 'bg-blue-500/10 border-blue-500 text-blue-300 font-medium'
                          : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300'
                      }`}>
                        <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt}
                          onChange={() => setAnswers(p => ({ ...p, [q.id]: opt }))} className="accent-blue-500" />
                        {opt}
                      </label>
                    ))}
                  </div>
                ) : (
                  <input type="text" placeholder="Your answer..." value={answers[q.id] || ''}
                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} className={inputCls} />
                )}
              </div>
            ))}

            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setQuestions(null)}
                className="flex-1 border border-white/10 text-gray-400 py-3 rounded-xl font-medium hover:bg-white/5 transition text-sm">
                Back
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-500/20">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <>Get My Estimate <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </form>

        ) : !estimate ? (
          /* Quote request form */
          <form onSubmit={handleGetEstimate} className="space-y-4">
            {/* Job type */}
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
              <label className="block text-sm font-semibold text-white mb-4">What do you need done?</label>
              <div className="space-y-4 mb-4">
                {JOB_CATEGORIES.map(cat => (
                  <div key={cat.label}>
                    {cat.highlight ? (
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 mb-1">
                        <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <span>★</span> {cat.label}
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {cat.jobs.map(jt => (
                            <button
                              key={jt}
                              type="button"
                              onClick={() => setJobType(jt)}
                              className={`text-left px-3 py-2 rounded-lg text-sm border transition ${
                                jobType === jt
                                  ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 font-medium'
                                  : 'border-cyan-500/10 bg-cyan-500/5 text-gray-400 hover:border-cyan-500/30 hover:text-cyan-300'
                              }`}
                            >
                              {jt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-widest mb-0.5">{cat.label}</p>
                        {cat.description && <p className="text-xs text-gray-500 mb-2">{cat.description}</p>}
                        {!cat.description && <div className="mb-2" />}
                        <div className="grid grid-cols-2 gap-1.5">
                          {cat.jobs.map(jt => (
                            <button
                              key={jt}
                              type="button"
                              onClick={() => setJobType(jt === 'Other / Describe below' ? '' : jt)}
                              className={`text-left px-3 py-2 rounded-lg text-sm border transition ${
                                jobType === jt
                                  ? 'bg-blue-500/10 border-blue-500 text-blue-300 font-medium'
                                  : 'border-white/5 bg-white/3 text-gray-400 hover:border-white/15 hover:text-gray-300'
                              }`}
                            >
                              {jt}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your issue in detail — the more you share, the more accurate your estimate will be..."
                rows={4}
                className={inputCls + ' resize-none'}
              />
            </div>

            {/* Urgency */}
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
              <label className="block text-sm font-semibold text-white mb-3">How soon do you need it?</label>
              <div className="grid grid-cols-3 gap-3">
                {URGENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgency(opt.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-sm transition ${
                      urgency === opt.value ? opt.activeClass : 'border-white/5 text-gray-500 hover:border-white/15 hover:text-gray-400'
                    }`}
                  >
                    {opt.icon}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload */}
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
              <label className="block text-sm font-semibold text-white mb-3">
                Upload photos <span className="text-gray-600 font-normal">(optional)</span>
              </label>
              <label className="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-8 cursor-pointer hover:border-blue-500/40 hover:bg-blue-500/5 transition">
                <Upload className="w-7 h-7 text-gray-600 mb-2" />
                <span className="text-sm text-gray-500">Click to upload photos or video</span>
                <input type="file" multiple accept="image/*,video/*" className="hidden"
                  onChange={e => setFiles(Array.from(e.target.files || []))} />
              </label>
              {files.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">{files.length} file(s) selected</p>
              )}
            </div>

            {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-400 text-white py-4 rounded-xl font-semibold text-lg transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
              {loading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating estimate...</>
                : <>Get My Estimate <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

        ) : (
          /* Estimate result */
          <div className="space-y-4">
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/10 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">Your Estimate</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{estimate.summary}</p>
                </div>
                <span className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${
                  estimate.confidence === 'high' ? 'bg-green-500/15 text-green-400 border border-green-500/20' :
                  estimate.confidence === 'medium' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20' :
                  'bg-red-500/15 text-red-400 border border-red-500/20'
                }`}>
                  {estimate.confidence} confidence
                </span>
              </div>

              <div className="p-6 space-y-5">
                {/* Line items table */}
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="text-left text-gray-600 border-b border-white/5">
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium text-right whitespace-nowrap pl-4">Qty</th>
                      <th className="pb-2 font-medium text-right whitespace-nowrap pl-4">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {estimate.line_items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2.5 text-gray-300">{item.description}</td>
                        <td className="py-2.5 text-right text-gray-500 whitespace-nowrap pl-4">
                          {item.quantity} {item.unit === 'each' ? 'ea.' : item.unit === 'hours' ? 'hrs' : item.unit}
                        </td>
                        <td className="py-2.5 text-right font-medium text-white whitespace-nowrap pl-4">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-white/10 pt-4 space-y-1.5 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Labor ({estimate.labor_hours}h)</span>
                    <span>{formatCurrency(estimate.labor_cost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Parts</span>
                    <span>{formatCurrency(estimate.parts_cost)}</span>
                  </div>
                  {estimate.urgency_surcharge > 0 && (
                    <div className="flex justify-between text-orange-400">
                      <span>Urgency surcharge</span>
                      <span>+{formatCurrency(estimate.urgency_surcharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-3 border-t border-white/10">
                    <span className="text-white">Total Estimate</span>
                    <span className="text-blue-400">{formatCurrency(estimate.total)}</span>
                  </div>
                </div>

                {estimate.notes && <EstimateNotes notes={estimate.notes} />}
              </div>
            </div>

            {/* Book job form */}
            <form onSubmit={handleBookJob} className="bg-gray-900 border border-white/10 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-white">Book this job</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input required placeholder="Your name" value={clientInfo.name}
                  onChange={e => setClientInfo(p => ({ ...p, name: e.target.value }))} className={inputCls} />
                <input required type="email" placeholder="Email address" value={clientInfo.email}
                  onChange={e => setClientInfo(p => ({ ...p, email: e.target.value }))} className={inputCls} />
                <input placeholder="Phone number" value={clientInfo.phone}
                  onChange={e => setClientInfo(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={() => setEstimate(null)}
                  className="flex-1 border border-white/10 text-gray-400 py-3 rounded-xl font-medium hover:bg-white/5 transition text-sm">
                  Edit Request
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-blue-500 hover:bg-blue-400 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
