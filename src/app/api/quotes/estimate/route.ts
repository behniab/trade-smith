import { NextRequest, NextResponse } from 'next/server'
import { generateQuote } from '@/lib/ai/quote-engine'
import { createAdminClient } from '@/lib/supabase/server'
import { AppSettings, UrgencyLevel } from '@/types'

const DEFAULT_SETTINGS: AppSettings = {
  labor_rate_per_hour: 125,
  parts_markup_percent: 20,
  urgent_multiplier: 1.25,
  emergency_multiplier: 1.75,
  service_area: 'United States',
  business_name: 'Trade-Smith Plumbing',
  business_phone: '',
  business_email: '',
  business_address: '',
  license_number: null,
  stripe_enabled: false,
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const description = formData.get('description') as string
    const job_type = formData.get('job_type') as string | null
    const urgency = (formData.get('urgency') as UrgencyLevel) || 'standard'

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // Load settings from DB, fall back to defaults
    let settings = DEFAULT_SETTINGS
    try {
      const supabase = await createAdminClient()
      const { data } = await supabase.from('settings').select('*').single()
      if (data) settings = { ...DEFAULT_SETTINGS, ...data }
    } catch {}

    const estimate = await generateQuote({
      description,
      job_type: job_type || null,
      urgency,
      media_urls: [], // TODO: upload to storage and pass URLs
      settings,
    })

    return NextResponse.json({ estimate })
  } catch (err: unknown) {
    console.error('Quote estimate error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate estimate' },
      { status: 500 }
    )
  }
}
