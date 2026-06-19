'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, MapPin, Loader2, Truck, Clock, Navigation, Zap } from 'lucide-react'

interface Vehicle {
  id: string
  name: string
  label: string | null
  license_plate: string | null
  provider: string
  last_ping: {
    lat: number
    lng: number
    speed_mph: number | null
    heading: number | null
    ignition: boolean | null
    received_at: string
  } | null
}

interface Trip {
  id: string
  started_at: string
  ended_at: string | null
  distance_mi: number | null
  start_lat: number
  start_lng: number
  end_lat: number | null
  end_lng: number | null
  vehicles: { name: string; label: string | null } | null
}

function headingLabel(deg: number | null) {
  if (deg === null) return '—'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function GpsDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [provider, setProvider] = useState('zonar')

  const load = useCallback(async () => {
    const [vRes, tRes, cfgRes] = await Promise.all([
      fetch('/api/integrations/gps?action=latest').then(r => r.json()),
      fetch('/api/integrations/gps?action=trips').then(r => r.json()),
      fetch('/api/integrations/gps?action=config').then(r => r.json()),
    ])
    setVehicles(vRes.vehicles ?? [])
    setTrips(tRes.trips ?? [])
    if (cfgRes.gps_provider) setProvider(cfgRes.gps_provider)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  async function syncNow() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res = await fetch(`/api/integrations/gps/${provider}?action=sync`)
      const data = await res.json()
      setSyncMsg(data.ok ? `Synced ${data.synced} vehicles` : (data.error ?? 'Sync failed'))
      await load()
    } catch { setSyncMsg('Sync failed') }
    finally { setSyncing(false); setTimeout(() => setSyncMsg(null), 5000) }
  }

  const selectedVehicle = vehicles.find(v => v.id === selected)
  const filteredTrips = selected ? trips.filter(t => t.vehicles?.name === selectedVehicle?.name) : trips

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GPS Fleet Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live vehicle locations and trip history</p>
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && <span className="text-sm text-gray-500">{syncMsg}</span>}
          <button onClick={syncNow} disabled={syncing}
            className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sync Now
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 py-20 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading vehicle data…
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl px-6 py-16 text-center">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No vehicles tracked yet</p>
          <p className="text-sm text-gray-400 mt-1">Configure your GPS provider in Settings → Integrations, then click Sync Now.</p>
        </div>
      ) : (
        <>
          {/* Vehicle grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map(v => {
              const ping = v.last_ping
              const isMoving = ping && (ping.speed_mph ?? 0) > 2
              const isSelected = selected === v.id
              return (
                <button key={v.id} onClick={() => setSelected(isSelected ? null : v.id)}
                  className={`text-left bg-white border rounded-2xl p-5 shadow-sm transition hover:shadow-md ${
                    isSelected ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-gray-200'
                  }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isMoving ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        <Truck className={`w-4 h-4 ${isMoving ? 'text-emerald-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{v.name}</p>
                        {v.license_plate && <p className="text-xs text-gray-400">{v.license_plate}</p>}
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      !ping ? 'bg-gray-100 text-gray-400' :
                      isMoving ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {!ping ? 'No data' : isMoving ? 'Moving' : 'Parked'}
                    </span>
                  </div>

                  {ping ? (
                    <div className="space-y-1.5 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Navigation className="w-3 h-3" />
                        <span>{ping.lat.toFixed(5)}, {ping.lng.toFixed(5)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{ping.speed_mph != null ? `${ping.speed_mph.toFixed(0)} mph` : '— mph'}</span>
                        <span>{headingLabel(ping.heading)}</span>
                        <span className={`flex items-center gap-1 ${ping.ignition ? 'text-green-600' : 'text-gray-400'}`}>
                          ● {ping.ignition ? 'On' : 'Off'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-gray-400">
                        <Clock className="w-3 h-3" />{timeAgo(ping.received_at)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No ping received yet</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Map placeholder — swap in Google Maps / Mapbox when ready */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {selected ? `${selectedVehicle?.name} — Live Location` : 'All Vehicles — Live Map'}
              </h2>
              {selected && (
                <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600">
                  Show all
                </button>
              )}
            </div>
            <div className="bg-gray-50 h-72 flex flex-col items-center justify-center gap-3 text-gray-400">
              <MapPin className="w-8 h-8" />
              <div className="text-center">
                <p className="font-medium text-sm">Map view</p>
                <p className="text-xs mt-0.5">Add a Google Maps or Mapbox API key in settings to enable the live map</p>
              </div>
              {(selected ? [selectedVehicle].filter(Boolean) : vehicles).filter(v => v?.last_ping).map(v => (
                <a key={v!.id}
                  href={`https://www.google.com/maps?q=${v!.last_ping!.lat},${v!.last_ping!.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline">
                  Open {v!.name} in Google Maps ↗
                </a>
              ))}
            </div>
          </div>

          {/* Trip history */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                Trip History {selected ? `— ${selectedVehicle?.name}` : ''}
              </h2>
            </div>
            {filteredTrips.length === 0 ? (
              <p className="text-sm text-gray-400 p-6">No trips recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-left text-xs">
                      <th className="px-4 py-3 font-medium">Vehicle</th>
                      <th className="px-4 py-3 font-medium">Started</th>
                      <th className="px-4 py-3 font-medium">Ended</th>
                      <th className="px-4 py-3 font-medium">Distance</th>
                      <th className="px-4 py-3 font-medium">Start Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredTrips.map(t => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{t.vehicles?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(t.started_at).toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.ended_at ? new Date(t.ended_at).toLocaleString() : 'In progress'}</td>
                        <td className="px-4 py-3 text-gray-500">{t.distance_mi != null ? `${t.distance_mi.toFixed(1)} mi` : '—'}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          <a href={`https://www.google.com/maps?q=${t.start_lat},${t.start_lng}`}
                            target="_blank" rel="noopener noreferrer" className="hover:text-blue-600">
                            {t.start_lat.toFixed(4)}, {t.start_lng.toFixed(4)} ↗
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
