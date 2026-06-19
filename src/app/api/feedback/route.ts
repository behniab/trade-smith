import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateLearning } from '@/lib/ai/quote-engine'
import { AppSettings } from '@/types'

const DEFAULT_SETTINGS: AppSettings = {
  labor_rate_per_hour: 125, parts_markup_percent: 20,
  urgent_multiplier: 1.25, emergency_multiplier: 1.75,
  service_area: 'United States', business_name: 'Trade-Smith Plumbing',
  business_phone: '', business_email: '', business_address: '',
  license_number: null, stripe_enabled: false,
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const body = await req.json()
  const {
    job_id, quote_id, accuracy_rating,
    estimated_total, actual_labor_cost, actual_parts_cost, actual_total,
    variance_reason, admin_notes, tags,
    job_description, job_type, estimate,
  } = body

  // Generate AI learning summary
  let ai_learning_summary: string | null = null
  try {
    const { data: settingsRow } = await supabase.from('settings').select('*').single()
    const settings = settingsRow ? { ...DEFAULT_SETTINGS, ...settingsRow } : DEFAULT_SETTINGS
    ai_learning_summary = await generateLearning({
      job_description, job_type, estimate,
      accuracy_rating, actual_labor_cost, actual_parts_cost,
      actual_total, estimated_total, variance_reason, admin_notes, tags,
      settings,
    })
  } catch (e) {
    console.error('generateLearning failed:', e)
  }

  const { data, error } = await supabase
    .from('quote_feedback')
    .upsert({
      job_id, quote_id, accuracy_rating,
      estimated_total, actual_labor_cost, actual_parts_cost, actual_total,
      variance_reason, admin_notes, tags: tags ?? [],
      ai_learning_summary,
    }, { onConflict: 'job_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('quote_feedback')
    .select('*, jobs(title, description)')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}
