'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Store, Phone, MapPin, X } from 'lucide-react'
import { VendorInfo } from '@/types'

interface Props {
  value: VendorInfo | null
  onChange: (vendor: VendorInfo | null) => void
  serviceArea: string
  label?: string
  placeholder?: string
}

export default function VendorSearch({ value, onChange, serviceArea, label = 'Preferred Vendor', placeholder = 'Search by name…' }: Props) {
  const [query, setQuery] = useState(value?.name ?? '')
  const [results, setResults] = useState<VendorInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ q: query, area: serviceArea || '' })
        const res = await fetch(`/api/vendors/search?${params}`)
        const data = await res.json()
        setResults(data.vendors ?? [])
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, serviceArea])

  function select(v: VendorInfo) {
    onChange(v)
    setQuery(v.name)
    setOpen(false)
    setResults([])
  }

  function clear() {
    onChange(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 pr-8'

  return (
    <div ref={ref} className="relative">
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (value) onChange(null) }}
          onFocus={() => { if (results.length) setOpen(true) }}
          placeholder={serviceArea ? placeholder : 'Set service area first'}
          disabled={!serviceArea}
          className={inputCls + (!serviceArea ? ' opacity-50 cursor-not-allowed' : '')}
        />
        {loading && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-gray-400" />}
        {!loading && value && (
          <button type="button" onClick={clear} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((v, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => select(v)}
                className="w-full text-left px-3 py-3 hover:bg-blue-50 border-b last:border-b-0"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Store className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                  {v.name}
                </div>
                {v.address && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 ml-5">
                    <MapPin className="w-3 h-3 shrink-0" /> {v.address}
                  </div>
                )}
                {v.phone && (
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500 ml-5">
                    <Phone className="w-3 h-3 shrink-0" /> {v.phone}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow px-3 py-2 text-sm text-gray-500">
          No vendors found near {serviceArea || 'your service area'}.
        </div>
      )}

      {value && (
        <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm space-y-0.5">
          <div className="font-medium text-blue-900">{value.name}</div>
          {value.address && <div className="flex items-center gap-1.5 text-xs text-blue-700"><MapPin className="w-3 h-3 shrink-0" />{value.address}</div>}
          {value.phone && <div className="flex items-center gap-1.5 text-xs text-blue-700"><Phone className="w-3 h-3 shrink-0" />{value.phone}</div>}
        </div>
      )}
    </div>
  )
}
