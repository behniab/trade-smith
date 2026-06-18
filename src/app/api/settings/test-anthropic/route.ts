import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('settings').select('anthropic_api_key').single()

    const apiKey = data?.anthropic_api_key || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'No API key configured.' }, { status: 400 })

    const client = new Anthropic({ apiKey })
    await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Test failed'
    const isAuth = msg.includes('401') || msg.toLowerCase().includes('authentication') || msg.toLowerCase().includes('api key')
    return NextResponse.json(
      { error: isAuth ? 'Invalid API key — authentication failed.' : msg },
      { status: 400 }
    )
  }
}
