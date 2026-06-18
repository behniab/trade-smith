import Anthropic from '@anthropic-ai/sdk'
import { AppSettings, QuoteEstimate, UrgencyLevel } from '@/types'

const client = new Anthropic()

interface QuoteInput {
  description: string
  job_type: string | null
  urgency: UrgencyLevel
  media_urls: string[]
  settings: AppSettings
}

export async function generateQuote(input: QuoteInput): Promise<QuoteEstimate> {
  const { description, job_type, urgency, settings } = input

  const urgencyMultiplier =
    urgency === 'emergency'
      ? settings.emergency_multiplier
      : urgency === 'urgent'
        ? settings.urgent_multiplier
        : 1.0

  const systemPrompt = `You are an expert plumbing estimator for ${settings.business_name} based in ${settings.service_area}.

Your job is to generate accurate cost estimates for plumbing jobs based on customer descriptions.

Current rates:
- Labor: $${settings.labor_rate_per_hour}/hour
- Parts markup: ${settings.parts_markup_percent}%
- Urgency multiplier (${urgency}): ${urgencyMultiplier}x

Return a JSON object matching this exact structure:
{
  "line_items": [
    { "description": "string", "quantity": number, "unit": "string", "unit_cost": number, "total": number }
  ],
  "labor_hours": number,
  "labor_cost": number,
  "parts_cost": number,
  "urgency_surcharge": number,
  "subtotal": number,
  "total": number,
  "summary": "1-2 sentence plain-English summary of the job and estimate",
  "confidence": "low" | "medium" | "high",
  "notes": "any caveats, e.g. 'Final price may vary once wall is opened'"
}

Rules:
- labor_cost = labor_hours * ${settings.labor_rate_per_hour} * ${urgencyMultiplier}
- parts_cost includes the ${settings.parts_markup_percent}% markup
- urgency_surcharge = the dollar amount added due to urgency (0 if standard)
- subtotal = labor_cost + parts_cost (before surcharge)
- total = subtotal + urgency_surcharge
- Use realistic parts prices for ${settings.service_area}
- Be conservative — err toward medium estimates with a note
- confidence is "low" if description is vague, "high" if very specific`

  const userMessage = `Job type: ${job_type || 'Not specified'}
Urgency: ${urgency}
Customer description: ${description}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI did not return valid JSON estimate')

  return JSON.parse(jsonMatch[0]) as QuoteEstimate
}
