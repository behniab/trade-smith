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
  "notes": "caveats as a newline-separated numbered list ONLY. No inline lists, no parentheses style. Each item on its own line. Example format:\n1. Final price may vary once wall is opened\n2. Permit may be required\n3. Drywall repair not included"
}

Rules:
- labor_cost = labor_hours * ${settings.labor_rate_per_hour} * ${urgencyMultiplier}
- parts_cost includes the ${settings.parts_markup_percent}% markup
- urgency_surcharge = the dollar amount added due to urgency (0 if standard)
- subtotal = labor_cost + parts_cost (before surcharge)
- total = subtotal + urgency_surcharge
- Use realistic parts prices for ${settings.service_area}
- Be conservative — err toward medium estimates with a note
- confidence is "low" if description is vague, "high" if very specific
- notes MUST be a newline-separated numbered list (1. item\n2. item). Never write inline lists like "(1) ... (2) ...". Never write a prose paragraph for notes.`

  const userMessage = `Job type: ${job_type || 'Not specified'}
Urgency: ${urgency}
Customer description: ${description}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Estimate generation was cut short — please try again or simplify your description.')
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not generate a valid estimate. Please try again.')

  try {
    return JSON.parse(jsonMatch[0]) as QuoteEstimate
  } catch {
    throw new Error('Could not parse the estimate. Please try again.')
  }
}
