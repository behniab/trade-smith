import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, status, urgency, scheduled_date, created_at, clients(name, email), quotes(estimate)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data })
}
