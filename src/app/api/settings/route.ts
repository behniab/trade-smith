import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MASK = '••••••••••••••••'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) return NextResponse.json({ settings: null })

  const masked = {
    ...data,
    anthropic_api_key: data.anthropic_api_key ? MASK : '',
    workwave_api_key: data.workwave_api_key ? MASK : '',
    qb_client_secret: data.qb_client_secret ? MASK : '',
    qb_access_token: data.qb_access_token ? MASK : '',
    qb_refresh_token: data.qb_refresh_token ? MASK : '',
    gps_api_key: data.gps_api_key ? MASK : '',
    gps_api_secret: data.gps_api_secret ? MASK : '',
    gps_client_id: data.gps_client_id ?? '',
  }
  return NextResponse.json({ settings: masked })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  // If the submitted key is the mask or empty, don't touch the stored key
  const { anthropic_api_key, workwave_api_key, qb_client_secret, qb_access_token, qb_refresh_token, gps_api_key, gps_api_secret, ...rest } = body
  const update: Record<string, unknown> = { id: 1, ...rest }
  if (anthropic_api_key && anthropic_api_key !== MASK) update.anthropic_api_key = anthropic_api_key
  if (workwave_api_key && workwave_api_key !== MASK) update.workwave_api_key = workwave_api_key
  if (qb_client_secret && qb_client_secret !== MASK) update.qb_client_secret = qb_client_secret
  if (gps_api_key && gps_api_key !== MASK) update.gps_api_key = gps_api_key
  if (gps_api_secret && gps_api_secret !== MASK) update.gps_api_secret = gps_api_secret

  const { error } = await supabase.from('settings').upsert(update)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
