'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench, Upload, Loader2, AlertTriangle, Zap, CalendarCheck } from 'lucide-react'
import Link from 'next/link'
import { QuoteEstimate, UrgencyLevel } from '@/types'
import { formatCurrency } from '@/lib/utils'

const JOB_CATEGORIES: { label: string; jobs: string[] }[] = [
  {
    label: 'Faucets & Fixtures',
    jobs: [
      'Fix leaking faucet',
      'Replace faucet',
      'Fix running toilet',
      'Install toilet',
      'Replace toilet',
      'Install bathroom sink',
      'Install bathtub / shower',
      'Fix shower pressure',
    ],
  },
  {
    label: 'Drains & Clogs',
    jobs: [
      'Unclog drain',
      'Unclog toilet',
      'Install drain / p-trap',
      'Sewer line inspection',
    ],
  },
  {
    label: 'Water Heater',
    jobs: [
      'Water heater replacement',
      'Water heater repair',
      'Tankless water heater install',
    ],
  },
  {
    label: 'Pipes',
    jobs: [
      'Pipe burst repair',
      'Pipe leak repair',
      'Repipe / repiping',
      'Frozen pipe thaw',
    ],
  },
  {
    label: 'Appliances',
    jobs: [
      'Install garbage disposal',
      'Install dishwasher',
      'Install washing machine hookup',
      'Install outdoor hose bib',
    ],
  },
  {
    label: 'Water Quality & Pressure',
    jobs: [
      'Low water pressure fix',
      'Install water softener',
      'Install water filter / purifier',
    ],
  },
  {
    label: 'Gas Lines',
    jobs: [
      'Gas line repair',
      'Gas line installation',
    ],
  },
  {
    label: 'Other',
    jobs: ['Other / Describe below'],
  },
]

const JOB_TYPES = JOB_CATEGORIES.flatMap(c => c.jobs)

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'standard', label: 'Standard', desc: 'Within a few days', icon: <Wrench className="w-4 h-4" /> },
  { value: 'urgent', label: 'Urgent', desc: 'Within 24 hours', icon: <AlertTriangle className="w-4 h-4" /> },
  { value: 'emergency', label: 'Emergency', desc: 'Right now', icon: <Zap className="w-4 h-4" /> },
]

function EstimateNotes({ notes }: { notes: string }) {
  // Split on numbered list patterns like "1. ... 2. ..." whether inline or on new lines
  const items = notes
    .split(/(?:^|\n|\s{2,})(?=\d+\.\s)/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)

  if (items.length > 1) {
    return (
      <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</p>
        <ol className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-xs text-gray-600">
              <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-[10px]">
                {i + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
      <p className="text-xs text-gray-600">{notes}</p>
    </div>
  )
}

export default function RequestQuotePage() {
  const router = useRouter()
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

  async function handleGetEstimate(e: React.FormEvent) {
    e.preventDefault()
    if (!description.trim()) { setError('Please describe your job.'); return }
    setError('')
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('description', description)
      formData.append('job_type', jobType)
      formData.append('urgency', urgency)
      files.forEach(f => formData.append('media', f))

      const res = await fetch('/api/quotes/estimate', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate estimate')
      setEstimate(data.estimate)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleBookJob(e: React.FormEvent) {
    e.preventDefault()
    if (!estimate) return
    setLoading(true)

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, job_type: jobType, urgency, estimate, client: clientInfo }),
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-12 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Wrench className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Request Submitted!</h2>
          <p className="text-gray-500 mb-6">Your quote has been received. You can wait for us to contact you, or book a time slot right now.</p>
          <div className="flex flex-col gap-3">
            {jobId && (
              <Link
                href={`/schedule/${jobId}?name=${encodeURIComponent(clientInfo.name)}&email=${encodeURIComponent(clientInfo.email)}`}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
              >
                <CalendarCheck className="w-5 h-5" />
                Schedule Repair Now
              </Link>
            )}
            <Link href="/" className="text-blue-600 font-medium hover:underline text-sm">Back to home</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-blue-600">
          <Wrench className="w-5 h-5" /> Trade-Smith
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600 text-sm">Request a Quote</span>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Get an Instant Quote</h1>
        <p className="text-gray-500 mb-8">Describe your job and we&apos;ll generate a cost estimate in seconds.</p>

        {!estimate ? (
          <form onSubmit={handleGetEstimate} className="space-y-6">
            {/* Job type */}
            <div className="bg-white rounded-xl border p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-4">What do you need done?</label>
              <div className="space-y-4 mb-4">
                {JOB_CATEGORIES.map(cat => (
                  <div key={cat.label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{cat.label}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.jobs.map(jt => (
                        <button
                          key={jt}
                          type="button"
                          onClick={() => setJobType(jt === 'Other / Describe below' ? '' : jt)}
                          className={`text-left px-3 py-2 rounded-lg text-sm border transition ${
                            jobType === jt ? 'bg-blue-50 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {jt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your issue in detail — the more you share, the more accurate your estimate will be..."
                rows={4}
                className="w-full border rounded-lg px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
            </div>

            {/* Urgency */}
            <div className="bg-white rounded-xl border p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">How soon do you need it?</label>
              <div className="grid grid-cols-3 gap-3">
                {URGENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setUrgency(opt.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition ${
                      urgency === opt.value
                        ? opt.value === 'emergency' ? 'bg-red-50 border-red-400 text-red-700'
                          : opt.value === 'urgent' ? 'bg-orange-50 border-orange-400 text-orange-700'
                          : 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.icon}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Media upload */}
            <div className="bg-white rounded-xl border p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Upload photos or video <span className="text-gray-400 font-normal">(optional, helps accuracy)</span>
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-blue-400 transition">
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-500">Click to upload photos or video</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={e => setFiles(Array.from(e.target.files || []))}
                />
              </label>
              {files.length > 0 && (
                <p className="text-sm text-gray-500 mt-2">{files.length} file(s) selected</p>
              )}
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating estimate...</> : 'Get My Estimate'}
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Estimate result */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="bg-blue-600 px-6 py-4 text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Your Estimate</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    estimate.confidence === 'high' ? 'bg-green-400 text-green-900' :
                    estimate.confidence === 'medium' ? 'bg-yellow-400 text-yellow-900' :
                    'bg-red-400 text-red-900'
                  }`}>
                    {estimate.confidence} confidence
                  </span>
                </div>
                <p className="text-blue-100 text-sm mt-1">{estimate.summary}</p>
              </div>

              <div className="p-6 space-y-4">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2 font-medium">Item</th>
                      <th className="pb-2 font-medium text-right whitespace-nowrap pl-4">Qty</th>
                      <th className="pb-2 font-medium text-right whitespace-nowrap pl-4">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {estimate.line_items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2 text-gray-700">{item.description}</td>
                        <td className="py-2 text-right text-gray-500 whitespace-nowrap pl-4">
                          {item.quantity} {item.unit === 'each' ? 'ea.' : item.unit === 'hours' ? 'hrs' : item.unit}
                        </td>
                        <td className="py-2 text-right font-medium text-gray-900 whitespace-nowrap pl-4">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t pt-4 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Labor ({estimate.labor_hours}h)</span>
                    <span>{formatCurrency(estimate.labor_cost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Parts</span>
                    <span>{formatCurrency(estimate.parts_cost)}</span>
                  </div>
                  {estimate.urgency_surcharge > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Urgency surcharge</span>
                      <span>+{formatCurrency(estimate.urgency_surcharge)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t text-gray-900">
                    <span>Total Estimate</span>
                    <span className="text-blue-600">{formatCurrency(estimate.total)}</span>
                  </div>
                </div>

                {estimate.notes && (
                  <EstimateNotes notes={estimate.notes} />
                )}
              </div>
            </div>

            {/* Book job form */}
            <form onSubmit={handleBookJob} className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Book this job</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  required
                  placeholder="Your name"
                  value={clientInfo.name}
                  onChange={e => setClientInfo(p => ({ ...p, name: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <input
                  required
                  type="email"
                  placeholder="Email address"
                  value={clientInfo.email}
                  onChange={e => setClientInfo(p => ({ ...p, email: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <input
                  placeholder="Phone number"
                  value={clientInfo.phone}
                  onChange={e => setClientInfo(p => ({ ...p, phone: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEstimate(null)}
                  className="flex-1 border text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                >
                  Edit Request
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
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
