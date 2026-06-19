'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save, KeyRound, CheckCircle2, XCircle } from 'lucide-react'
import { AppSettings } from '@/types'
import AddressInput from '@/components/AddressInput'

const MASK = '••••••••••••••••'

const DEFAULT: AppSettings = {
  labor_rate_per_hour: 125,
  parts_markup_percent: 20,
  urgent_multiplier: 1.25,
  emergency_multiplier: 1.75,
  service_area: '',
  business_name: '',
  business_phone: '',
  business_email: '',
  business_address: '',
  license_number: null,
  stripe_enabled: false,
  anthropic_api_key: '',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [anthropicKey, setAnthropicKey] = useState('')
  const [keyIsSet, setKeyIsSet] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [savedKey, setSavedKey] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [testError, setTestError] = useState('')

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.settings) {
        setSettings({ ...DEFAULT, ...d.settings, anthropic_api_key: '' })
        setKeyIsSet(d.settings.anthropic_api_key === MASK)
      }
      setLoading(false)
    })
  }, [])

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings(p => ({ ...p, [key]: value }))
    setSaved(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSaving(false)
    setSaved(true)
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault()
    if (!anthropicKey.trim()) return
    setSavingKey(true)
    setSavedKey(false)
    setTestResult(null)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: anthropicKey.trim() }),
    })
    setSavingKey(false)
    setSavedKey(true)
    setKeyIsSet(true)
    setAnthropicKey('')
  }

  async function handleTestKey() {
    setTestingKey(true)
    setTestResult(null)
    setTestError('')
    const res = await fetch('/api/settings/test-anthropic', { method: 'POST' })
    const data = await res.json()
    setTestingKey(false)
    if (data.ok) {
      setTestResult('success')
    } else {
      setTestResult('error')
      setTestError(data.error || 'Test failed')
    }
  }

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin w-4 h-4" /> Loading settings...</div>
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-500 mb-8 text-sm">Configure your business rates and information. These values power the AI quote engine.</p>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Business info */}
        <section className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Business Information</h2>
          <Field label="Business Name" value={settings.business_name} onChange={v => set('business_name', v)} />
          <Field label="Phone" value={settings.business_phone} onChange={v => set('business_phone', v)} />
          <Field label="Email" value={settings.business_email} onChange={v => set('business_email', v)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <AddressInput
              value={settings.business_address}
              onChange={v => set('business_address', v)}
              onCityStateChange={v => set('service_area', v)}
            />
          </div>
          <Field label="Service Area (city/state)" value={settings.service_area} onChange={v => set('service_area', v)} placeholder="e.g. Phoenix, AZ" />
          <Field label="License Number" value={settings.license_number || ''} onChange={v => set('license_number', v || null)} required={false} />
        </section>

        {/* Pricing */}
        <section className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Pricing Rates</h2>
          <p className="text-xs text-gray-500">These rates are fed directly to the AI quote engine for every estimate.</p>
          <NumberField label="Labor Rate ($/hr)" value={settings.labor_rate_per_hour} onChange={v => set('labor_rate_per_hour', v)} min={0} step={5} />
          <NumberField label="Parts Markup (%)" value={settings.parts_markup_percent} onChange={v => set('parts_markup_percent', v)} min={0} max={200} step={1} />
          <NumberField label="Urgent Multiplier (e.g. 1.25 = +25%)" value={settings.urgent_multiplier} onChange={v => set('urgent_multiplier', v)} min={1} max={5} step={0.05} />
          <NumberField label="Emergency Multiplier (e.g. 1.75 = +75%)" value={settings.emergency_multiplier} onChange={v => set('emergency_multiplier', v)} min={1} max={5} step={0.05} />
        </section>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>

      {/* API Keys — separate form so keys aren't bundled with business settings */}
      <form onSubmit={handleSaveKey} className="mt-6 space-y-6">
        <section className="bg-white rounded-xl border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">API Keys</h2>
          </div>
          <p className="text-xs text-gray-500">
            Enter your own Anthropic API key so this deployment uses your account for quote generation.
            Keys are stored encrypted and never returned in plain text.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anthropic API Key
              {keyIsSet && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full font-normal">
                  <CheckCircle2 className="w-3 h-3" /> Configured
                </span>
              )}
            </label>
            <input
              type="password"
              value={anthropicKey}
              onChange={e => { setAnthropicKey(e.target.value); setSavedKey(false); setTestResult(null) }}
              placeholder={keyIsSet ? 'Enter a new key to replace the existing one' : 'sk-ant-...'}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <p className="text-xs text-gray-400 mt-1">
              Get your key at <span className="font-mono">console.anthropic.com</span> → API Keys
            </p>
          </div>

          {testResult === 'success' && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> API key is valid and working.
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 shrink-0" /> {testError}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={savingKey || !anthropicKey.trim()}
              className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingKey ? 'Saving...' : savedKey ? 'Saved!' : 'Save Key'}
            </button>
            {keyIsSet && (
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testingKey}
                className="flex items-center gap-2 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                {testingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {testingKey ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </section>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, required = true }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  )
}

function NumberField({ label, value, onChange, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        required
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  )
}
