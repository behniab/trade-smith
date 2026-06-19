import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const MASK = '••••••••••••••••'

async function loadConfig() {
  const { data } = await db().from('settings').select(
    'gps_provider,gps_api_key,gps_api_secret,gps_account_id,gps_poll_interval'
  ).single()
  return data
}

// GET ?action=vehicles|pings|trips|config|logs
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') ?? 'config'
  const supabase = db()

  if (action === 'config') {
    const cfg = await loadConfig()
    return NextResponse.json({
      ...cfg,
      gps_api_key: cfg?.gps_api_key ? MASK : '',
      gps_api_secret: cfg?.gps_api_secret ? MASK : '',
    })
  }

  if (action === 'vehicles') {
    const { data } = await supabase.from('vehicles').select('*').eq('active', true).order('name')
    return NextResponse.json({ vehicles: data ?? [] })
  }

  if (action === 'pings') {
    const vehicleId = req.nextUrl.searchParams.get('vehicle_id')
    let q = supabase.from('gps_pings').select('*').order('received_at', { ascending: false }).limit(200)
    if (vehicleId) q = q.eq('vehicle_id', vehicleId)
    const { data } = await q
    return NextResponse.json({ pings: data ?? [] })
  }

  if (action === 'latest') {
    // Latest ping per vehicle
    const { data: vehicles } = await supabase.from('vehicles').select('id,name,label,license_plate').eq('active', true)
    const result = await Promise.all((vehicles ?? []).map(async (v) => {
      const { data: pings } = await supabase.from('gps_pings')
        .select('*').eq('vehicle_id', v.id).order('received_at', { ascending: false }).limit(1)
      return { ...v, last_ping: pings?.[0] ?? null }
    }))
    return NextResponse.json({ vehicles: result })
  }

  if (action === 'trips') {
    const vehicleId = req.nextUrl.searchParams.get('vehicle_id')
    let q = supabase.from('gps_trips').select('*,vehicles(name,label)').order('started_at', { ascending: false }).limit(100)
    if (vehicleId) q = q.eq('vehicle_id', vehicleId)
    const { data } = await q
    return NextResponse.json({ trips: data ?? [] })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// POST — save config or ingest raw ping
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { action } = body

  if (action === 'save_config') {
    const update: Record<string, unknown> = {
      gps_provider: body.gps_provider,
      gps_account_id: body.gps_account_id,
      gps_poll_interval: body.gps_poll_interval ?? 60,
    }
    if (body.gps_api_key && body.gps_api_key !== MASK) update.gps_api_key = body.gps_api_key
    if (body.gps_api_secret && body.gps_api_secret !== MASK) update.gps_api_secret = body.gps_api_secret

    const supabase = db()
    const { count } = await supabase.from('settings').select('id', { count: 'exact', head: true })
    if (count === 0) {
      await supabase.from('settings').insert(update)
    } else {
      await supabase.from('settings').update(update).neq('id', '00000000-0000-0000-0000-000000000000')
    }
    return NextResponse.json({ ok: true })
  }

  // Ingest a raw ping (generic — provider routes call this internally)
  if (action === 'ingest_ping') {
    const { vehicle_provider_id, provider, lat, lng, speed_mph, heading, odometer, ignition, raw } = body
    const supabase = db()

    // Upsert vehicle
    let { data: vehicle } = await supabase.from('vehicles').select('id').eq('provider_id', vehicle_provider_id).single()
    if (!vehicle) {
      const { data: inserted } = await supabase.from('vehicles').insert({
        provider,
        provider_id: vehicle_provider_id,
        name: body.vehicle_name ?? vehicle_provider_id,
        label: body.vehicle_label,
        vin: body.vin,
        license_plate: body.license_plate,
      }).select('id').single()
      vehicle = inserted
    }

    if (!vehicle) return NextResponse.json({ error: 'Could not upsert vehicle' }, { status: 500 })

    await supabase.from('gps_pings').insert({
      vehicle_id: vehicle.id,
      lat, lng,
      speed_mph: speed_mph ?? null,
      heading: heading ?? null,
      odometer: odometer ?? null,
      ignition: ignition ?? null,
      raw: raw ?? null,
    })

    return NextResponse.json({ ok: true, vehicle_id: vehicle.id })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
