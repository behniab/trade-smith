'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Loader2, Trash2, Upload, X, ChevronDown, ChevronUp, Eye, EyeOff, ImageIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface PortfolioImage {
  url: string
  storage_path: string
  caption: string
}

interface PortfolioItem {
  id: string
  created_at: string
  title: string
  description: string
  job_type: string | null
  completed_date: string | null
  labor_cost: number | null
  parts_cost: number | null
  total_cost: number | null
  emergent_issues: string | null
  explanation: string | null
  images: PortfolioImage[]
  is_published: boolean
}

const EMPTY_FORM = {
  title: '',
  description: '',
  job_type: '',
  completed_date: '',
  labor_cost: '',
  parts_cost: '',
  total_cost: '',
  emergent_issues: '',
  explanation: '',
  is_published: true,
}

const inputCls = 'w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition'

export default function AdminGalleryPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formImages, setFormImages] = useState<PortfolioImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadItems() }, [])

  async function loadItems() {
    setLoading(true)
    const res = await fetch('/api/portfolio')
    const data = await res.json()
    setItems(data.items ?? [])
    setLoading(false)
  }

  function setField(key: string, value: string | boolean) {
    setForm(p => ({ ...p, [key]: value }))
    // Auto-calculate total
    if (key === 'labor_cost' || key === 'parts_cost') {
      const labor = parseFloat(key === 'labor_cost' ? value as string : form.labor_cost) || 0
      const parts = parseFloat(key === 'parts_cost' ? value as string : form.parts_cost) || 0
      setForm(p => ({ ...p, [key]: value as string, total_cost: (labor + parts).toFixed(2) }))
    }
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files) return
    setUploading(true)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/portfolio/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.url) {
        setFormImages(p => [...p, { url: data.url, storage_path: data.storage_path, caption: '' }])
      }
    }
    setUploading(false)
  }

  function removeImage(idx: number) {
    setFormImages(p => p.filter((_, i) => i !== idx))
  }

  function setCaption(idx: number, caption: string) {
    setFormImages(p => p.map((img, i) => i === idx ? { ...img, caption } : img))
  }

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormImages([])
    setShowForm(true)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  function openEdit(item: PortfolioItem) {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description,
      job_type: item.job_type ?? '',
      completed_date: item.completed_date ?? '',
      labor_cost: item.labor_cost?.toString() ?? '',
      parts_cost: item.parts_cost?.toString() ?? '',
      total_cost: item.total_cost?.toString() ?? '',
      emergent_issues: item.emergent_issues ?? '',
      explanation: item.explanation ?? '',
      is_published: item.is_published,
    })
    setFormImages(item.images ?? [])
    setShowForm(true)
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      title: form.title,
      description: form.description,
      job_type: form.job_type || null,
      completed_date: form.completed_date || null,
      labor_cost: form.labor_cost ? parseFloat(form.labor_cost) : null,
      parts_cost: form.parts_cost ? parseFloat(form.parts_cost) : null,
      total_cost: form.total_cost ? parseFloat(form.total_cost) : null,
      emergent_issues: form.emergent_issues || null,
      explanation: form.explanation || null,
      images: formImages,
      is_published: form.is_published,
    }

    if (editingId) {
      await fetch(`/api/portfolio/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    loadItems()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await fetch(`/api/portfolio/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    setItems(p => p.filter(i => i.id !== id))
  }

  async function togglePublished(item: PortfolioItem) {
    await fetch(`/api/portfolio/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !item.is_published }),
    })
    setItems(p => p.map(i => i.id === item.id ? { ...i, is_published: !i.is_published } : i))
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Gallery</h1>
          <p className="text-sm text-gray-500 mt-0.5">Showcase past jobs on the public gallery page</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
          <Plus className="w-4 h-4" /> Add Job
        </button>
      </div>

      {/* Entry form */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-gray-900 rounded-xl border border-white/10 p-6 mb-8 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold">{editingId ? 'Edit Entry' : 'New Portfolio Entry'}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Photos</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              {formImages.map((img, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-white/10 bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-start justify-end p-1">
                    <button type="button" onClick={() => removeImage(idx)}
                      className="bg-red-600 rounded-full p-1 text-white hover:bg-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    value={img.caption}
                    onChange={e => setCaption(idx, e.target.value)}
                    placeholder="Caption (optional)"
                    className="w-full bg-transparent border-t border-white/10 px-2 py-1.5 text-xs text-gray-400 placeholder-gray-600 focus:outline-none focus:text-white"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-28 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-600 hover:border-blue-500/40 hover:text-gray-400 hover:bg-blue-500/5 transition"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                <span className="text-xs">{uploading ? 'Uploading…' : 'Add photo'}</span>
              </button>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden"
              onChange={e => handleImageUpload(e.target.files)} />
          </div>

          {/* Title & type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Title *</label>
              <input required value={form.title} onChange={e => setField('title', e.target.value)}
                placeholder="e.g. Kitchen sink replacement" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Job Type</label>
              <input value={form.job_type} onChange={e => setField('job_type', e.target.value)}
                placeholder="e.g. Pipe repair" className={inputCls} />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Description *</label>
            <textarea required rows={3} value={form.description} onChange={e => setField('description', e.target.value)}
              placeholder="Describe the job and what was done…" className={inputCls + ' resize-none'} />
          </div>

          {/* Costs */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Costs</label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Labor ($)</label>
                <input type="number" min="0" step="0.01" value={form.labor_cost}
                  onChange={e => setField('labor_cost', e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Parts ($)</label>
                <input type="number" min="0" step="0.01" value={form.parts_cost}
                  onChange={e => setField('parts_cost', e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Total ($)</label>
                <input type="number" min="0" step="0.01" value={form.total_cost}
                  onChange={e => setField('total_cost', e.target.value)}
                  placeholder="Auto-calculated" className={inputCls} />
              </div>
            </div>
          </div>

          {/* Emergent issues */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Emergent Issues <span className="text-gray-700">(optional)</span></label>
            <textarea rows={2} value={form.emergent_issues} onChange={e => setField('emergent_issues', e.target.value)}
              placeholder="Any unexpected problems found during the job…" className={inputCls + ' resize-none'} />
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Explanation / Notes <span className="text-gray-700">(optional)</span></label>
            <textarea rows={3} value={form.explanation} onChange={e => setField('explanation', e.target.value)}
              placeholder="Technical explanation, approach taken, materials used…" className={inputCls + ' resize-none'} />
          </div>

          {/* Completed date & published */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Completed Date</label>
              <input type="date" value={form.completed_date} onChange={e => setField('completed_date', e.target.value)}
                className={inputCls} />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setField('is_published', !form.is_published)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${form.is_published ? 'bg-blue-500' : 'bg-gray-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_published ? 'left-5' : 'left-0.5'}`} />
                </div>
                <span className="text-sm text-gray-400">Published to gallery</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 border border-white/10 text-gray-400 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : editingId ? 'Save Changes' : 'Add to Portfolio'}
            </button>
          </div>
        </form>
      )}

      {/* Items list */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading portfolio…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 border rounded-xl bg-white">
          <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No portfolio entries yet. Add your first job to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const isExpanded = expandedId === item.id
            const cover = item.images?.[0]
            return (
              <div key={item.id} className="bg-white rounded-xl border overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover.url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 border" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{item.title}</p>
                      {!item.is_published && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Draft</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{item.description}</p>
                    {item.total_cost && (
                      <p className="text-xs text-blue-600 font-medium mt-0.5">{formatCurrency(item.total_cost)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => togglePublished(item)} title={item.is_published ? 'Unpublish' : 'Publish'}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                      {item.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(item)}
                      className="text-xs px-3 py-1.5 border rounded-lg text-gray-600 hover:bg-gray-50 transition">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-50">
                      {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 px-5 py-5 space-y-4">
                    {/* Photo strip */}
                    {item.images?.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {item.images.map((img, i) => (
                          <div key={i} className="shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.url} alt={img.caption || ''} className="h-24 w-32 rounded-lg object-cover border" />
                            {img.caption && <p className="text-xs text-gray-500 mt-1 w-32 truncate">{img.caption}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      {(item.labor_cost || item.parts_cost || item.total_cost) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Costs</p>
                          <div className="space-y-1">
                            {item.labor_cost && <div className="flex justify-between"><span className="text-gray-500">Labor</span><span className="font-medium text-gray-800">{formatCurrency(item.labor_cost)}</span></div>}
                            {item.parts_cost && <div className="flex justify-between"><span className="text-gray-500">Parts</span><span className="font-medium text-gray-800">{formatCurrency(item.parts_cost)}</span></div>}
                            {item.total_cost && <div className="flex justify-between border-t pt-1 mt-1"><span className="text-gray-700 font-semibold">Total</span><span className="font-bold text-gray-900">{formatCurrency(item.total_cost)}</span></div>}
                          </div>
                        </div>
                      )}
                      {item.completed_date && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Completed</p>
                          <p className="text-gray-700">{new Date(item.completed_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      )}
                    </div>

                    {item.emergent_issues && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Emergent Issues</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{item.emergent_issues}</p>
                      </div>
                    )}
                    {item.explanation && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Explanation</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{item.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
