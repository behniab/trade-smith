'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

export const US_STATES = [
  { abbr: 'AL', name: 'Alabama' }, { abbr: 'AK', name: 'Alaska' },
  { abbr: 'AZ', name: 'Arizona' }, { abbr: 'AR', name: 'Arkansas' },
  { abbr: 'CA', name: 'California' }, { abbr: 'CO', name: 'Colorado' },
  { abbr: 'CT', name: 'Connecticut' }, { abbr: 'DE', name: 'Delaware' },
  { abbr: 'FL', name: 'Florida' }, { abbr: 'GA', name: 'Georgia' },
  { abbr: 'HI', name: 'Hawaii' }, { abbr: 'ID', name: 'Idaho' },
  { abbr: 'IL', name: 'Illinois' }, { abbr: 'IN', name: 'Indiana' },
  { abbr: 'IA', name: 'Iowa' }, { abbr: 'KS', name: 'Kansas' },
  { abbr: 'KY', name: 'Kentucky' }, { abbr: 'LA', name: 'Louisiana' },
  { abbr: 'ME', name: 'Maine' }, { abbr: 'MD', name: 'Maryland' },
  { abbr: 'MA', name: 'Massachusetts' }, { abbr: 'MI', name: 'Michigan' },
  { abbr: 'MN', name: 'Minnesota' }, { abbr: 'MS', name: 'Mississippi' },
  { abbr: 'MO', name: 'Missouri' }, { abbr: 'MT', name: 'Montana' },
  { abbr: 'NE', name: 'Nebraska' }, { abbr: 'NV', name: 'Nevada' },
  { abbr: 'NH', name: 'New Hampshire' }, { abbr: 'NJ', name: 'New Jersey' },
  { abbr: 'NM', name: 'New Mexico' }, { abbr: 'NY', name: 'New York' },
  { abbr: 'NC', name: 'North Carolina' }, { abbr: 'ND', name: 'North Dakota' },
  { abbr: 'OH', name: 'Ohio' }, { abbr: 'OK', name: 'Oklahoma' },
  { abbr: 'OR', name: 'Oregon' }, { abbr: 'PA', name: 'Pennsylvania' },
  { abbr: 'RI', name: 'Rhode Island' }, { abbr: 'SC', name: 'South Carolina' },
  { abbr: 'SD', name: 'South Dakota' }, { abbr: 'TN', name: 'Tennessee' },
  { abbr: 'TX', name: 'Texas' }, { abbr: 'UT', name: 'Utah' },
  { abbr: 'VT', name: 'Vermont' }, { abbr: 'VA', name: 'Virginia' },
  { abbr: 'WA', name: 'Washington' }, { abbr: 'WV', name: 'West Virginia' },
  { abbr: 'WI', name: 'Wisconsin' }, { abbr: 'WY', name: 'Wyoming' },
  { abbr: 'DC', name: 'District of Columbia' },
]

function parseAddress(value: string) {
  // Best-effort parse of "Street, City, ST ZIP" or "Street, City, ST"
  const parts = value.split(',').map(s => s.trim())
  if (parts.length >= 3) {
    const last = parts[parts.length - 1]
    const stateZip = last.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?$/)
    if (stateZip) {
      return {
        street: parts.slice(0, parts.length - 2).join(', '),
        city: parts[parts.length - 2],
        state: stateZip[1],
        zip: stateZip[2] || '',
      }
    }
  }
  return { street: value, city: '', state: '', zip: '' }
}

function compose(street: string, city: string, state: string, zip: string) {
  const cityState = [city, state].filter(Boolean).join(', ')
  const cityStateZip = zip ? `${cityState} ${zip}` : cityState
  return [street, cityStateZip].filter(Boolean).join(', ')
}

interface Props {
  value: string
  onChange: (address: string) => void
  onCityStateChange?: (cityState: string) => void
}

export default function AddressInput({ value, onChange, onCityStateChange }: Props) {
  const parsed = parseAddress(value)
  const [street, setStreet] = useState(parsed.street)
  const [city, setCity] = useState(parsed.city)
  const [stateAbbr, setStateAbbr] = useState(parsed.state)
  const [zip, setZip] = useState(parsed.zip)

  const [stateQuery, setStateQuery] = useState(
    parsed.state ? (US_STATES.find(s => s.abbr === parsed.state)?.name ?? parsed.state) : ''
  )
  const [showStates, setShowStates] = useState(false)
  const stateRef = useRef<HTMLDivElement>(null)

  const [cityQuery, setCityQuery] = useState(parsed.city)
  const [cities, setCities] = useState<string[]>([])
  const [loadingCities, setLoadingCities] = useState(false)
  const [showCities, setShowCities] = useState(false)
  const cityRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (stateRef.current && !stateRef.current.contains(e.target as Node)) setShowStates(false)
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setShowCities(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch cities when state changes
  useEffect(() => {
    if (!stateAbbr) { setCities([]); return }
    const stateName = US_STATES.find(s => s.abbr === stateAbbr)?.name
    if (!stateName) return
    setLoadingCities(true)
    fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: 'United States', state: stateName }),
    })
      .then(r => r.json())
      .then(d => { setCities((d.data as string[]) || []) })
      .catch(() => {})
      .finally(() => setLoadingCities(false))
  }, [stateAbbr])

  // Compose and emit whenever any part changes
  useEffect(() => {
    onChange(compose(street, city, stateAbbr, zip))
    if (city && stateAbbr) onCityStateChange?.(`${city}, ${stateAbbr}`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, city, stateAbbr, zip])

  const filteredStates = US_STATES.filter(s =>
    s.name.toLowerCase().includes(stateQuery.toLowerCase()) ||
    s.abbr.toLowerCase().startsWith(stateQuery.toUpperCase())
  )

  const filteredCities = cityQuery.length >= 1
    ? cities.filter(c => c.toLowerCase().startsWith(cityQuery.toLowerCase())).slice(0, 8)
    : []

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

  return (
    <div className="space-y-3">
      {/* Street */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
        <input
          value={street}
          onChange={e => setStreet(e.target.value)}
          placeholder="123 Main St"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* City autocomplete */}
        <div ref={cityRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <div className="relative">
            <input
              value={cityQuery}
              onChange={e => { setCityQuery(e.target.value); setCity(e.target.value); setShowCities(true) }}
              onFocus={() => { if (filteredCities.length) setShowCities(true) }}
              placeholder={stateAbbr ? 'Start typing…' : 'Select state first'}
              disabled={!stateAbbr}
              className={inputCls + (!stateAbbr ? ' opacity-50 cursor-not-allowed' : '')}
            />
            {loadingCities && (
              <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-gray-400" />
            )}
          </div>
          {showCities && filteredCities.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredCities.map(c => (
                <li key={c}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => { setCity(c); setCityQuery(c); setShowCities(false) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 text-gray-800"
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* State combobox */}
        <div ref={stateRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input
            value={stateQuery}
            onChange={e => {
              setStateQuery(e.target.value)
              setShowStates(true)
              // If they cleared it, also clear state and city
              if (!e.target.value) { setStateAbbr(''); setCity(''); setCityQuery('') }
            }}
            onFocus={() => setShowStates(true)}
            placeholder="Type state…"
            className={inputCls}
          />
          {showStates && filteredStates.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {filteredStates.map(s => (
                <li key={s.abbr}>
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                      setStateAbbr(s.abbr)
                      setStateQuery(s.name)
                      setCity(''); setCityQuery('')
                      setShowStates(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex justify-between ${stateAbbr === s.abbr ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-800'}`}
                  >
                    <span>{s.name}</span>
                    <span className="text-gray-400 text-xs">{s.abbr}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ZIP */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
        <input
          value={zip}
          onChange={e => setZip(e.target.value)}
          placeholder="85001"
          maxLength={10}
          className={inputCls + ' max-w-[140px]'}
        />
      </div>
    </div>
  )
}
