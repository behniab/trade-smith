'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, RefreshCw, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight, Zap, BookOpen, MapPin } from 'lucide-react'

interface SyncLog {
  id: string
  created_at: string
  entity_type: string
  entity_id: string | null
  status: 'ok' | 'error' | 'pending'
  workwave_request_id: string | null
  error_message: string | null
  source?: string
}

interface WorkWaveConfig {
  workwave_api_key: string
  workwave_territory_id: string
  workwave_base_url: string
}

interface QBConfig {
  qb_client_id: string
  qb_client_secret: string
  qb_realm_id: string
  qb_environment: string
  qb_connected: boolean
}

const WW_SYNC_ENTITIES = [
  { key: 'client',   label: 'Clients',        description: 'Sync client records as Companies in Route Manager' },
  { key: 'job',      label: 'Jobs',            description: 'Sync jobs as Orders in Route Manager' },
  { key: 'quote',    label: 'Quotes',          description: 'Sync accepted quotes as Orders with estimated values' },
  { key: 'calendar', label: 'Calendar Events', description: 'Sync scheduled jobs with dates into Route Manager' },
  { key: 'invoice',  label: 'Invoices',        description: 'Sync invoices as revenue Orders in Route Manager' },
]

const QB_SYNC_ENTITIES = [
  { key: 'client',  label: 'Clients',  description: 'Sync clients as Customers in QuickBooks' },
  { key: 'invoice', label: 'Invoices', description: 'Sync invoices with line items and amounts' },
]

type SyncState = 'idle' | 'loading' | 'ok' | 'error'

function SyncRow({ label, description, state, msg, onSync }: {
  label: string; description: string; state: SyncState; msg?: string; onSync: () => void
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400">{description}</p>
        {msg && <p className={`text-xs mt-0.5 ${state === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
      </div>
      <button onClick={onSync} disabled={state === 'loading'}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium border transition ml-4 shrink-0 ${
          state === 'ok'    ? 'bg-green-50 border-green-200 text-green-700' :
          state === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
          'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40'
        }`}>
        {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> :
         state === 'ok'      ? <CheckCircle2 className="w-3 h-3" /> :
         state === 'error'   ? <XCircle className="w-3 h-3" /> :
         <RefreshCw className="w-3 h-3" />}
        {state === 'ok' ? 'Synced' : state === 'error' ? 'Failed' : 'Sync'}
      </button>
    </div>
  )
}

function SyncAllButton({ state, onClick }: { state: SyncState; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={state === 'loading'}
      className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition ${
        state === 'ok'    ? 'bg-green-500 text-white' :
        state === 'error' ? 'bg-red-500 text-white' :
        'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50'
      }`}>
      {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> :
       state === 'ok'      ? <CheckCircle2 className="w-4 h-4" /> :
       state === 'error'   ? <XCircle className="w-4 h-4" /> :
       <RefreshCw className="w-4 h-4" />}
      {state === 'ok' ? 'All Synced' : state === 'error' ? 'Sync Failed' : 'Sync All'}
    </button>
  )
}

export default function IntegrationsPage() {
  // WorkWave state
  const [ww, setWw] = useState<WorkWaveConfig>({ workwave_api_key: '', workwave_territory_id: '', workwave_base_url: 'https://wwrm.workwave.com' })
  const [wwSaving, setWwSaving] = useState(false)
  const [wwSaveMsg, setWwSaveMsg] = useState<string | null>(null)
  const [wwTest, setWwTest] = useState<SyncState>('idle')
  const [wwTestMsg, setWwTestMsg] = useState<string | null>(null)
  const [territories, setTerritories] = useState<{ id: string; name: string }[]>([])
  const [wwSyncAll, setWwSyncAll] = useState<SyncState>('idle')
  const [wwEntityStates, setWwEntityStates] = useState<Record<string, SyncState>>({})
  const [wwEntityMsgs, setWwEntityMsgs] = useState<Record<string, string>>({})
  const [wwLogs, setWwLogs] = useState<SyncLog[]>([])
  const [showWwLogs, setShowWwLogs] = useState(false)
  const [showWwKey, setShowWwKey] = useState(false)

  // QuickBooks state
  const [qb, setQb] = useState<QBConfig>({ qb_client_id: '', qb_client_secret: '', qb_realm_id: '', qb_environment: 'sandbox', qb_connected: false })
  const [qbSaving, setQbSaving] = useState(false)
  const [qbSaveMsg, setQbSaveMsg] = useState<string | null>(null)
  const [qbTest, setQbTest] = useState<SyncState>('idle')
  const [qbTestMsg, setQbTestMsg] = useState<string | null>(null)
  const [qbSyncAll, setQbSyncAll] = useState<SyncState>('idle')
  const [qbEntityStates, setQbEntityStates] = useState<Record<string, SyncState>>({})
  const [qbEntityMsgs, setQbEntityMsgs] = useState<Record<string, string>>({})
  const [qbLogs, setQbLogs] = useState<SyncLog[]>([])
  const [showQbLogs, setShowQbLogs] = useState(false)
  const [showQbSecret, setShowQbSecret] = useState(false)
  const [qbConnecting, setQbConnecting] = useState(false)

  const loadLogs = useCallback(async () => {
    const [wwRes, qbRes] = await Promise.all([
      fetch('/api/integrations/workwave').then(r => r.json()),
      fetch('/api/integrations/quickbooks?action=logs').then(r => r.json()),
    ])
    setWwLogs(wwRes.logs ?? [])
    setQbLogs(qbRes.logs ?? [])
  }, [])

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(({ settings: data }) => {
        if (!data) return
        setWw({
          workwave_api_key: data.workwave_api_key ?? '',
          workwave_territory_id: data.workwave_territory_id ?? '',
          workwave_base_url: data.workwave_base_url ?? 'https://wwrm.workwave.com',
        })
        setQb({
          qb_client_id: data.qb_client_id ?? '',
          qb_client_secret: data.qb_client_secret ?? '',
          qb_realm_id: data.qb_realm_id ?? '',
          qb_environment: data.qb_environment ?? 'sandbox',
          qb_connected: !!(data.qb_access_token && data.qb_access_token !== '••••••••••••••••'),
        })
        setGps({
          gps_provider: data.gps_provider ?? 'zonar',
          gps_api_key: data.gps_api_key ?? '',
          gps_api_secret: data.gps_api_secret ?? '',
          gps_account_id: data.gps_account_id ?? '',
          gps_poll_interval: data.gps_poll_interval ?? 60,
        })
      })
    loadLogs()

    // Handle OAuth callback result
    const params = new URLSearchParams(window.location.search)
    if (params.get('qb') === 'connected') {
      setQb(c => ({ ...c, qb_connected: true }))
      setQbTest('ok')
      setQbTestMsg('QuickBooks connected successfully')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('qb') === 'error') {
      setQbTest('error')
      setQbTestMsg(`OAuth error: ${params.get('reason') ?? 'unknown'}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [loadLogs])

  // ---- WorkWave actions ----
  async function saveWw() {
    setWwSaving(true); setWwSaveMsg(null)
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ww) })
      if (!res.ok) throw new Error(await res.text())
      setWwSaveMsg('Saved')
    } catch (e) { setWwSaveMsg(`Error: ${e}`) }
    finally { setWwSaving(false); setTimeout(() => setWwSaveMsg(null), 3000) }
  }

  async function testWw() {
    setWwTest('loading'); setWwTestMsg(null); setTerritories([])
    try {
      const res = await fetch('/api/integrations/workwave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const terrs = Object.entries(data.territories ?? {}).map(([id, t]: [string, unknown]) => ({ id, name: (t as { name: string }).name }))
      setTerritories(terrs)
      setWwTest('ok')
      setWwTestMsg(`Connected — ${terrs.length} territory${terrs.length !== 1 ? 'ies' : 'y'} found`)
    } catch (e) { setWwTest('error'); setWwTestMsg(String(e)) }
  }

  async function syncWwEntity(entity: string) {
    setWwEntityStates(s => ({ ...s, [entity]: 'loading' }))
    try {
      const res = await fetch('/api/integrations/workwave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWwEntityStates(s => ({ ...s, [entity]: 'ok' }))
      const count = data.result?.count ?? (data.result?.requestId ? 1 : null)
      setWwEntityMsgs(s => ({ ...s, [entity]: count != null ? `Synced ${count} record${count !== 1 ? 's' : ''}` : 'Synced' }))
    } catch (e) {
      setWwEntityStates(s => ({ ...s, [entity]: 'error' }))
      setWwEntityMsgs(s => ({ ...s, [entity]: String(e) }))
    } finally { loadLogs() }
  }

  async function syncAllWw() {
    setWwSyncAll('loading')
    try {
      const res = await fetch('/api/integrations/workwave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync_all' }) })
      if (!res.ok) throw new Error()
      setWwSyncAll('ok')
    } catch { setWwSyncAll('error') }
    finally { loadLogs(); setTimeout(() => setWwSyncAll('idle'), 4000) }
  }

  // ---- QuickBooks actions ----
  async function saveQb() {
    setQbSaving(true); setQbSaveMsg(null)
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        qb_client_id: qb.qb_client_id,
        qb_client_secret: qb.qb_client_secret,
        qb_realm_id: qb.qb_realm_id,
        qb_environment: qb.qb_environment,
      })})
      if (!res.ok) throw new Error(await res.text())
      setQbSaveMsg('Saved')
    } catch (e) { setQbSaveMsg(`Error: ${e}`) }
    finally { setQbSaving(false); setTimeout(() => setQbSaveMsg(null), 3000) }
  }

  async function connectQb() {
    setQbConnecting(true)
    try {
      const res = await fetch('/api/integrations/quickbooks?action=auth_url')
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not build auth URL')
      window.location.href = data.url
    } catch (e) {
      setQbTest('error')
      setQbTestMsg(String(e))
      setQbConnecting(false)
    }
  }

  async function testQb() {
    setQbTest('loading'); setQbTestMsg(null)
    try {
      const res = await fetch('/api/integrations/quickbooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'test' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQbTest('ok')
      setQbTestMsg(`Connected — ${data.company?.CompanyName ?? 'Company found'}`)
    } catch (e) { setQbTest('error'); setQbTestMsg(String(e)) }
  }

  async function syncQbEntity(entity: string) {
    setQbEntityStates(s => ({ ...s, [entity]: 'loading' }))
    try {
      const res = await fetch('/api/integrations/quickbooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQbEntityStates(s => ({ ...s, [entity]: 'ok' }))
      const count = data.result?.count ?? (data.result?.qb_id ? 1 : null)
      setQbEntityMsgs(s => ({ ...s, [entity]: count != null ? `Synced ${count} record${count !== 1 ? 's' : ''}` : 'Synced' }))
    } catch (e) {
      setQbEntityStates(s => ({ ...s, [entity]: 'error' }))
      setQbEntityMsgs(s => ({ ...s, [entity]: String(e) }))
    } finally { loadLogs() }
  }

  async function syncAllQb() {
    setQbSyncAll('loading')
    try {
      const res = await fetch('/api/integrations/quickbooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sync_all' }) })
      if (!res.ok) throw new Error()
      setQbSyncAll('ok')
    } catch { setQbSyncAll('error') }
    finally { loadLogs(); setTimeout(() => setQbSyncAll('idle'), 4000) }
  }

  // ---- GPS state ----
  const [gps, setGps] = useState({ gps_provider: 'zonar', gps_api_key: '', gps_api_secret: '', gps_account_id: '', gps_poll_interval: 60 })
  const [gpsSaving, setGpsSaving] = useState(false)
  const [gpsSaveMsg, setGpsSaveMsg] = useState<string | null>(null)
  const [gpsTest, setGpsTest] = useState<SyncState>('idle')
  const [gpsTestMsg, setGpsTestMsg] = useState<string | null>(null)
  const [gpsSync, setGpsSync] = useState<SyncState>('idle')
  const [gpsSyncMsg, setGpsSyncMsg] = useState<string | null>(null)
  const [showGpsKey, setShowGpsKey] = useState(false)

  async function saveGps() {
    setGpsSaving(true); setGpsSaveMsg(null)
    try {
      const res = await fetch('/api/integrations/gps', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_config', ...gps }) })
      if (!res.ok) throw new Error(await res.text())
      setGpsSaveMsg('Saved')
    } catch (e) { setGpsSaveMsg(`Error: ${e}`) }
    finally { setGpsSaving(false); setTimeout(() => setGpsSaveMsg(null), 3000) }
  }

  async function testGps() {
    setGpsTest('loading'); setGpsTestMsg(null)
    try {
      const res = await fetch(`/api/integrations/gps/${gps.gps_provider}?action=test`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setGpsTest('ok'); setGpsTestMsg(data.message ?? 'Connection successful')
    } catch (e) { setGpsTest('error'); setGpsTestMsg(String(e)) }
  }

  async function syncGps() {
    setGpsSync('loading'); setGpsSyncMsg(null)
    try {
      const res = await fetch(`/api/integrations/gps/${gps.gps_provider}?action=sync`)
      const data = await res.json()
      if (!data.ok && data.errors > 0) throw new Error(`${data.errors} vehicles failed`)
      setGpsSync('ok'); setGpsSyncMsg(`Synced ${data.synced ?? 0} vehicle${data.synced !== 1 ? 's' : ''}`)
    } catch (e) { setGpsSync('error'); setGpsSyncMsg(String(e)) }
    finally { setTimeout(() => setGpsSync('idle'), 5000) }
  }

  const wwConfigured = !!ww.workwave_api_key
  const qbConfigured = !!qb.qb_client_id
  const gpsConfigured = !!gps.gps_api_key && !!gps.gps_account_id

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1 text-sm">Connect third-party apps to sync your data.</p>
      </div>

      {/* ---- WorkWave ---- */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
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
          <a href="https://wwrm.workwave.com/api/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
            API Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">API Key</label>
            <p className="text-xs text-gray-400">WorkWave Route Manager → Admin → API Settings</p>
            <div className="flex gap-2">
              <input type={showWwKey ? 'text' : 'password'} value={ww.workwave_api_key}
                onChange={e => setWw(c => ({ ...c, workwave_api_key: e.target.value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => setShowWwKey(s => !s)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                {showWwKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Territory ID</label>
            <p className="text-xs text-gray-400">Test the connection below to discover your territory IDs.</p>
            <input type="text" value={ww.workwave_territory_id}
              onChange={e => setWw(c => ({ ...c, workwave_territory_id: e.target.value }))}
              placeholder="Territory UUID"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {territories.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-medium text-gray-600">Available territories — click to select:</p>
                {territories.map(t => (
                  <button key={t.id} onClick={() => setWw(c => ({ ...c, workwave_territory_id: t.id }))}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${ww.workwave_territory_id === t.id ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{t.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Base URL <span className="font-normal text-gray-400">(optional)</span></label>
            <input type="text" value={ww.workwave_base_url}
              onChange={e => setWw(c => ({ ...c, workwave_base_url: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={saveWw} disabled={wwSaving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-50">
              {wwSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
            <button onClick={testWw} disabled={wwTest === 'loading' || !ww.workwave_api_key}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-40">
              {wwTest === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Test Connection
            </button>
            {wwSaveMsg && <span className="text-sm text-gray-500 self-center">{wwSaveMsg}</span>}
          </div>

          {wwTestMsg && (
            <div className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${wwTest === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {wwTest === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {wwTestMsg}
            </div>
          )}
        </div>

        {wwConfigured && (
          <div className="border-t border-gray-100 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Sync Data</h3>
              <SyncAllButton state={wwSyncAll} onClick={syncAllWw} />
            </div>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {WW_SYNC_ENTITIES.map(({ key, label, description }) => (
                <SyncRow key={key} label={label} description={description}
                  state={wwEntityStates[key] ?? 'idle'} msg={wwEntityMsgs[key]}
                  onSync={() => syncWwEntity(key)} />
              ))}
            </div>
          </div>
        )}

        {wwConfigured && (
          <div className="border-t border-gray-100 px-6 py-4">
            <button onClick={() => setShowWwLogs(s => !s)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
              {showWwLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Sync Log ({wwLogs.length})
            </button>
            {showWwLogs && <LogTable logs={wwLogs} />}
          </div>
        )}
      </div>

      {/* ---- QuickBooks ---- */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">QuickBooks Online</h2>
              <p className="text-xs text-gray-400">Sync clients and invoices with your accounting</p>
            </div>
          </div>
          <a href="https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/invoice"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
            API Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Setup instructions */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Setup required in Intuit Developer Portal</p>
            <ol className="list-decimal list-inside space-y-0.5 text-amber-700">
              <li>Go to <span className="font-mono">developer.intuit.com</span> → Create an app</li>
              <li>Add OAuth 2.0 redirect URI: <span className="font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/api/integrations/quickbooks/callback</span></li>
              <li>Copy your Client ID and Client Secret below, then click Connect</li>
            </ol>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Client ID</label>
              <input type="text" value={qb.qb_client_id}
                onChange={e => setQb(c => ({ ...c, qb_client_id: e.target.value }))}
                placeholder="ABxxx..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Client Secret</label>
              <div className="flex gap-2">
                <input type={showQbSecret ? 'text' : 'password'} value={qb.qb_client_secret}
                  onChange={e => setQb(c => ({ ...c, qb_client_secret: e.target.value }))}
                  placeholder="••••••••"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={() => setShowQbSecret(s => !s)} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                  {showQbSecret ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Realm ID <span className="font-normal text-gray-400">(auto-filled on connect)</span></label>
              <input type="text" value={qb.qb_realm_id}
                onChange={e => setQb(c => ({ ...c, qb_realm_id: e.target.value }))}
                placeholder="123456789"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Environment</label>
              <select value={qb.qb_environment} onChange={e => setQb(c => ({ ...c, qb_environment: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="sandbox">Sandbox (testing)</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button onClick={saveQb} disabled={qbSaving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-50">
              {qbSaving && <Loader2 className="w-4 h-4 animate-spin" />} Save
            </button>
            <button onClick={connectQb} disabled={qbConnecting || !qb.qb_client_id || !qb.qb_client_secret}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-40 border ${
                qb.qb_connected ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}>
              {qbConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : qb.qb_connected ? <CheckCircle2 className="w-4 h-4" /> : null}
              {qb.qb_connected ? 'Reconnect with QuickBooks' : 'Connect with QuickBooks'}
            </button>
            {qb.qb_connected && (
              <button onClick={testQb} disabled={qbTest === 'loading'}
                className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm px-4 py-2 rounded-lg font-medium transition disabled:opacity-40">
                {qbTest === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Test Connection
              </button>
            )}
            {qbSaveMsg && <span className="text-sm text-gray-500 self-center">{qbSaveMsg}</span>}
          </div>

          {qbTestMsg && (
            <div className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${qbTest === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {qbTest === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {qbTestMsg}
            </div>
          )}
        </div>

        {qbConfigured && qb.qb_connected && (
          <div className="border-t border-gray-100 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Sync Data</h3>
              <SyncAllButton state={qbSyncAll} onClick={syncAllQb} />
            </div>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {QB_SYNC_ENTITIES.map(({ key, label, description }) => (
                <SyncRow key={key} label={label} description={description}
                  state={qbEntityStates[key] ?? 'idle'} msg={qbEntityMsgs[key]}
                  onSync={() => syncQbEntity(key)} />
              ))}
            </div>
          </div>
        )}

        {qbConfigured && (
          <div className="border-t border-gray-100 px-6 py-4">
            <button onClick={() => setShowQbLogs(s => !s)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium">
              {showQbLogs ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Sync Log ({qbLogs.length})
            </button>
            {showQbLogs && <LogTable logs={qbLogs} />}
          </div>
        )}
      </div>

      {/* ---- GPS Tracking ---- */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">GPS Fleet Tracking</h2>
              <p className="text-xs text-gray-400">Track vehicles in real-time, view trips and history</p>
            </div>
          </div>
          <a href="/admin/gps" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
            Open Dashboard →
          </a>
        </div>

        <div className="px-6 py-6 space-y-5">
          {/* Provider selector */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">GPS Provider</label>
            <select value={gps.gps_provider} onChange={e => setGps(g => ({ ...g, gps_provider: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="zonar">Zonar (GTC API)</option>
              <option value="samsara">Samsara (coming soon)</option>
              <option value="geotab">Geotab (coming soon)</option>
              <option value="verizon">Verizon Connect (coming soon)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Account ID / Username</label>
            <p className="text-xs text-gray-400">Your Zonar customer account ID</p>
            <input type="text" value={gps.gps_account_id}
              onChange={e => setGps(g => ({ ...g, gps_account_id: e.target.value }))}
              placeholder="e.g. 12345"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">API Key / Password</label>
            <p className="text-xs text-gray-400">Zonar GTC API credentials</p>
            <div className="flex gap-2">
              <input type={showGpsKey ? 'text' : 'password'} value={gps.gps_api_key}
                onChange={e => setGps(g => ({ ...g, gps_api_key: e.target.value }))}
                placeholder="••••••••••••••••"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <button type="button" onClick={() => setShowGpsKey(s => !s)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                {showGpsKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Poll Interval (seconds)</label>
            <input type="number" value={gps.gps_poll_interval} min={30} max={3600}
              onChange={e => setGps(g => ({ ...g, gps_poll_interval: parseInt(e.target.value) || 60 }))}
              className="w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={saveGps} disabled={gpsSaving}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
              {gpsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save
            </button>
            <button onClick={testGps} disabled={gpsTest === 'loading' || !gpsConfigured}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium border transition disabled:opacity-40 ${
                gpsTest === 'ok'    ? 'bg-green-50 border-green-200 text-green-700' :
                gpsTest === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}>
              {gpsTest === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Test Connection
            </button>
            {gpsSaveMsg && <span className="text-sm text-gray-500">{gpsSaveMsg}</span>}
          </div>

          {gpsTestMsg && (
            <div className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${gpsTest === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {gpsTest === 'ok' ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              {gpsTestMsg}
            </div>
          )}
        </div>

        {gpsConfigured && (
          <div className="border-t border-gray-100 px-6 py-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Sync Vehicles</h3>
              <button onClick={syncGps} disabled={gpsSync === 'loading'}
                className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition ${
                  gpsSync === 'ok'    ? 'bg-green-500 text-white' :
                  gpsSync === 'error' ? 'bg-red-500 text-white' :
                  'bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50'
                }`}>
                {gpsSync === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 gpsSync === 'ok'      ? <CheckCircle2 className="w-4 h-4" /> :
                 gpsSync === 'error'   ? <XCircle className="w-4 h-4" /> :
                 <RefreshCw className="w-4 h-4" />}
                {gpsSync === 'ok' ? 'Synced' : gpsSync === 'error' ? 'Failed' : 'Sync Now'}
              </button>
            </div>
            {gpsSyncMsg && (
              <p className={`text-sm ${gpsSync === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{gpsSyncMsg}</p>
            )}
            <p className="text-xs text-gray-400">Pulls latest location for all vehicles from {gps.gps_provider === 'zonar' ? 'Zonar GTC' : gps.gps_provider}. View live map and trip history in the GPS Dashboard.</p>
          </div>
        )}
      </div>

      {/* Coming soon */}
      <div className="bg-white border border-dashed border-gray-200 rounded-2xl px-6 py-8 text-center text-gray-400">
        <p className="text-sm font-medium">More integrations coming soon</p>
        <p className="text-xs mt-1">Stripe, SMS notifications, and more</p>
      </div>
    </div>
  )
}

function LogTable({ logs }: { logs: SyncLog[] }) {
  return (
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
                <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
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
  )
}
