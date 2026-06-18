import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MASK = '••••••••••••••••'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) return NextResponse.json({ settings: null })

  // Never return the real API key to the browser — send a mask if it's set
  const masked = {
    ...data,
    anthropic_api_key: data.anthropic_api_key ? MASK : '',
  }
  return NextResponse.json({ settings: masked })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()

  // If the submitted key is the mask or empty, don't touch the stored key
  const { anthropic_api_key, ...rest } = body
  const update: Record<string, unknown> = { id: 1, ...rest }
  if (anthropic_api_key && anthropic_api_key !== MASK) {
    update.anthropic_api_key = anthropic_api_key
  }

  const { error } = await supabase.from('settings').upsert(update)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
