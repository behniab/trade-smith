'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, RefreshCw, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Zap } from 'lucide-react'

interface SyncLog {
  id: string
  created_at: string
  entity_type: string
  entity_id: string | null
  status: 'ok' | 'error' | 'pending'
  workwave_request_id: string | null
  error_message: string | null
}

interface WorkWaveConfig {
  workwave_api_key: string
  workwave_territory_id: string
  workwave_base_url: string
}

const SYNC_ENTITIES = [
  { key: 'client',   label: 'Clients',         description: 'Sync all client records as Companies in Route Manager' },
  { key: 'job',      label: 'Jobs',             description: 'Sync all jobs as Orders in Route Manager' },
  { key: 'quote',    label: 'Quotes',           description: 'Sync accepted quotes as Orders with estimated values' },
  { key: 'calendar', label: 'Calendar Events',  description: 'Sync scheduled jobs with dates into Route Manager' },
  { key: 'invoice',  label: 'Invoices',         description: 'Sync invoices as revenue Orders in Route Manager' },
]

type SyncState = 'idle' | 'loading' | 'ok' | 'error'

export default function IntegrationsPage() {
  const [cfg, setCfg] = useState<WorkWaveConfig>({ workwave_api_key: '', workwave_territory_id: '', workwave_base_url: 'https://wwrm.workwave.com' })
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [testState, setTestState] = useState<SyncState>('idle')
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [territories, setTerritories] = useState<{ id: string; name: string }[]>([])
  const [syncAll, setSyncAll] = useState<SyncState>('idle')
  const [entityStates, setEntityStates] = useState<Record<string, SyncState>>({})
  const [entityMsgs, setEntityMsgs] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [showKey, setShowKey] = useState(false)

  const loadLogs = useCallback(async () => {
    const res = await fetch('/api/integrations/workwave')
    const data = await res.json()
    setLogs(data.logs ?? [])
  }, [])

  useEffect(() => {
    // Load existing settings
    fetch('/api/settings')
      .then(r => r.json())
      .then(({ settings: data }) => {
        if (!data) return
        setCfg({
          workwave_api_key: data.workwave_api_key ?? '',
          workwave_territory_id: data.workwave_territory_id ?? '',
          workwave_base_url: data.workwave_base_url ?? 'https://wwrm.workwave.com',
        })
      })
    loadLogs()
  }, [loadLogs])

  async function saveConfig() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
      if (!res.ok) throw new Error(await res.text())
      setSaveMsg('Saved')
    } catch (e) {
      setSaveMsg(`Error: ${e}`)
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  async function testConnection() {
    setTestState('loading')
    setTestMsg(null)
    setTerritories([])
    try {
      const res = await fetch('/api/integrations/workwave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const terrs = Object.entries(data.territories ?? {}).map(([id, t]: [string, unknown]) => ({ id, name: (t as { name: string }).name }))
      setTerritories(terrs)
      setTestState('ok')
      setTestMsg(`Connected — ${terrs.length} territory${terrs.length !== 1 ? 'ies' : 'y'} found`)
    } catch (e) {
      setTestState('error')
      setTestMsg(String(e))
    }
  }

  async function syncEntity(entity: string) {
    setEntityStates(s => ({ ...s, [entity]: 'loading' }))
    setEntityMsgs(s => ({ ...s, [entity]: '' }))
    try {
      const res = await fetch('/api/integrations/workwave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEntityStates(s => ({ ...s, [entity]: 'ok' }))
      const count = data.result?.count ?? data.result?.requestId ? 1 : null
      setEntityMsgs(s => ({ ...s, [entity]: count != null ? `Synced ${count} record${count !== 1 ? 's' : ''}` : 'Synced' }))
    } catch (e) {
      setEntityStates(s => ({ ...s, [entity]: 'error' }))
      setEntityMsgs(s => ({ ...s, [entity]: String(e) }))
    } finally {
      loadLogs()
    }
  }

  async function syncAllEntities() {
    setSyncAll('loading')
    try {
      const res = await fetch('/api/integrations/workwave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync_all' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncAll('ok')
    } catch {
      setSyncAll('error')
    } finally {
      loadLogs()
      setTimeout(() => setSyncAll('idle'), 4000)
    }
  }

  const configured = !!cfg.workwave_api_key

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1 text-sm">Connect third-party apps to sync your data.</p>
      </div>

      {/* WorkWave Route Manager card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Card header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">WorkWave Route Manager</h2>
              <p className="text-xs text-gray-400">Sync jobs, clients, quotes, and invoices</p>
            </div>
          </div>
          <a
            href="https://wwrm.workwave.com/api/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            API Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* API Key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">API Key</label>
            <p className="text-xs text-gray-400">Found in WorkWave Route Manager → Admin → API Settings. Format: UUID</p>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={cfg.workwave_api_key}
                onChange={e => setCfg(c => ({ ...c, workwave_api_key: e.target.value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button onClick={() => setShowKey(s => !s)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Territory ID */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Territory ID</label>
            <p className="text-xs text-gray-400">Required for syncing orders. Test the connection below to see available territory IDs.</p>
            <input
              type="text"
              value={cfg.workwave_territory_id}
              onChange={e => setCfg(c => ({ ...c, workwave_territory_id: e.target.value }))}
              placeholder="Territory UUID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {territories.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-600">Available territories — click to select:</p>
                {territories.map(t => (
                  <button key={t.id} onClick={() => setCfg(c => ({ ...c, workwave_territory_id: t.id }))}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${cfg.workwave_territory_id === t.id ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{t.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Base URL <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={cfg.workwave_base_url}
              onChange={e => setCfg(c => ({ ...c, workwave_base_url: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Save + Test row */}
          <div className="flex gap-3 pt-2">
            <button onClick={saveConfig} disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
            <button onClick={testConnection} disabled={testState === 'loading' || !cfg.workwave_api_key}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-40">
              {testState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Test Connection
            </button>
            {saveMsg && <span className="text-sm text-gray-500 self-center">{saveMsg}</span>}
          </div>

          {/* Test result */}
          {testMsg && (
            <div className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${testState === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testState === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {testMsg}
            </div>
          )}
        </div>

        {/* Sync section */}
        {configured && (
          <div className="border-t border-gray-100 px-6 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Sync Data</h3>
              <button
                onClick={syncAllEntities}
                disabled={syncAll === 'loading'}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition ${
                  syncAll === 'ok' ? 'bg-green-500 text-white' :
                  syncAll === 'error' ? 'bg-red-500 text-white' :
                  'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50'
                }`}
              >
                {syncAll === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 syncAll === 'ok' ? <CheckCircle2 className="w-4 h-4" /> :
                 syncAll === 'error' ? <XCircle className="w-4 h-4" /> :
                 <RefreshCw className="w-4 h-4" />}
                {syncAll === 'ok' ? 'All Synced' : syncAll === 'error' ? 'Sync Failed' : 'Sync All'}
              </button>
            </div>

            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {SYNC_ENTITIES.map(({ key, label, description }) => {
                const state = entityStates[key] ?? 'idle'
                const msg = entityMsgs[key]
                return (
                  <div key={key} className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      <p className="text-xs text-gray-400">{description}</p>
                      {msg && (
                        <p className={`text-xs mt-0.5 ${state === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>
                      )}
                    </div>
                    <button
                      onClick={() => syncEntity(key)}
                      disabled={state === 'loading'}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition ml-4 shrink-0 ${
                        state === 'ok' ? 'bg-green-50 border-green-200 text-green-700' :
                        state === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                        'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40'
                      }`}
                    >
                      {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                       state === 'ok' ? <CheckCircle2 className="w-3 h-3" /> :
                       state === 'error' ? <XCircle className="w-3 h-3" /> :
                       <RefreshCw className="w-3 h-3" />}
                      {state === 'ok' ? 'Synced' : state === 'error' ? 'Failed' : 'Sync'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Sync log */}
        {configured && (
          <div className="border-t border-gray-100 px-6 py-4">
            <button onClick={() => setShowLogs(s => !s)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
              {showLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Sync Log ({logs.length})
            </button>
            {showLogs && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-gray-100">
                {logs.length === 0 ? (
                  <p className="text-xs text-gray-400 p-4">No sync events yet.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-left">
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">Entity</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {logs.map(log => (
                        <tr key={log.id} className="bg-white">
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-gray-600 capitalize">{log.entity_type}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded font-medium ${log.status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-400 max-w-xs truncate">
                            {log.error_message ?? log.workwave_request_id ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coming soon placeholder */}
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl px-6 py-8 text-center text-gray-400">
        <p className="text-sm font-medium">More integrations coming soon</p>
        <p className="text-xs mt-1">QuickBooks, Stripe, Google Calendar sync, and more</p>
      </div>
    </div>
  )
}
