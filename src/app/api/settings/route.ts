import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase.from('settings').select('*').single()
  if (error) return NextResponse.json({ settings: null })
  return NextResponse.json({ settings: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createAdminClient()
  const body = await req.json()
  const { error } = await supabase.from('settings').upsert({ id: 1, ...body })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
