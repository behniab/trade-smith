import { NextRequest, NextResponse } from 'next/server'
import { generateQuote, generatePartsList, QuoteAnswer } from '@/lib/ai/quote-engine'
import { createAdminClient } from '@/lib/supabase/admin'
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
    const answersRaw = formData.get('answers') as string | null
    const answers: QuoteAnswer[] = answersRaw ? JSON.parse(answersRaw) : []

    if (!description?.trim()) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    let settings = DEFAULT_SETTINGS
    try {
      const { data } = await supabase.from('settings').select('*').single()
      if (data) settings = { ...DEFAULT_SETTINGS, ...data }
    } catch {}

    // Fetch recent learning summaries to inject into the prompt
    let learnings: string[] = []
    try {
      const { data: feedbackRows } = await supabase
        .from('quote_feedback')
        .select('ai_learning_summary')
        .not('ai_learning_summary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(8)
      learnings = (feedbackRows ?? []).map((r: { ai_learning_summary: string }) => r.ai_learning_summary).filter(Boolean)
    } catch {}

    const result = await generateQuote({ description, job_type, urgency, media_urls: [], settings, answers, learnings })

    if (result.type === 'questions') {
      return NextResponse.json({ questions: result.questions })
    }

    // Generate parts list — admin-only, not shown to customer
    let parts_list = null
    try {
      parts_list = await generatePartsList(result.estimate, description, job_type, settings)
    } catch (partsErr) {
      console.error('generatePartsList failed:', partsErr)
    }

    return NextResponse.json({ estimate: result.estimate, parts_list })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate estimate' },
      { status: 500 }
    )
  }
}
