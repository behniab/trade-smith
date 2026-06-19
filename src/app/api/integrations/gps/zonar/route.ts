import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Zonar Ground Traffic Control (GTC) API v2
// Base: https://gtcapi.zonarsystems.net/api/v2/
// Auth: HTTP Basic (username = gps_account_id, password = gps_api_key)
// Docs: https://gtcapi.zonarsystems.net/docs/

const ZONAR_BASE = 'https://gtcapi.zonarsystems.net/api/v2'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function loadConfig() {
  const { data } = await db().from('settings').select(
    'gps_api_key,gps_account_id'
  ).single()
  return data
}

function basicAuth(accountId: string, apiKey: string) {
  return 'Basic ' + Buffer.from(`${accountId}:${apiKey}`).toString('base64')
}

async function zonarFetch(path: string, accountId: string, apiKey: string) {
  const res = await fetch(`${ZONAR_BASE}${path}`, {
    headers: {
      Authorization: basicAuth(accountId, apiKey),
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Zonar API ${res.status}: ${text}`)
  }
  return res.json()
}

// Sync all vehicles + their latest location from Zonar
async function syncVehicles(accountId: string, apiKey: string) {
  const results: { vehicle: string; status: string; error?: string }[] = []

  // GET /assets — list all tracked assets
  const assets = await zonarFetch(`/accounts/${accountId}/assets`, accountId, apiKey)

  for (const asset of assets ?? []) {
    try {
      // GET latest location for each asset
      const location = await zonarFetch(
        `/accounts/${accountId}/assets/${asset.id}/locations?limit=1`,
        accountId, apiKey
      )
      const ping = Array.isArray(location) ? location[0] : location

      // Ingest through generic GPS route
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/integrations/gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ingest_ping',
          provider: 'zonar',
          vehicle_provider_id: String(asset.id),
          vehicle_name: asset.name ?? asset.license_plate ?? asset.id,
          vehicle_label: asset.description,
          vin: asset.vin,
          license_plate: asset.license_plate,
          lat: ping?.latitude ?? ping?.lat,
          lng: ping?.longitude ?? ping?.lng ?? ping?.lon,
          speed_mph: ping?.speed,
          heading: ping?.heading,
          odometer: ping?.odometer,
          ignition: ping?.ignition_status === 'on' || ping?.ignition === true,
          raw: ping,
        }),
      })
      results.push({ vehicle: asset.name ?? asset.id, status: 'ok' })
    } catch (err: unknown) {
      results.push({ vehicle: asset.name ?? asset.id, status: 'error', error: String(err) })
    }
  }
  return results
}

// GET ?action=test|sync
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') ?? 'test'
  const cfg = await loadConfig()

  if (!cfg?.gps_api_key || !cfg?.gps_account_id) {
    return NextResponse.json({ error: 'Zonar API key and account ID are required' }, { status: 400 })
  }

  if (action === 'test') {
    try {
      const data = await zonarFetch(`/accounts/${cfg.gps_account_id}/assets?limit=1`, cfg.gps_account_id, cfg.gps_api_key)
      return NextResponse.json({ ok: true, message: 'Zonar connection successful', sample: data })
    } catch (err: unknown) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 400 })
    }
  }

  if (action === 'sync') {
    try {
      const results = await syncVehicles(cfg.gps_account_id, cfg.gps_api_key)
      const errors = results.filter(r => r.status === 'error')
      return NextResponse.json({
        ok: errors.length === 0,
        synced: results.length,
        errors: errors.length,
        results,
      })
    } catch (err: unknown) {
      return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
