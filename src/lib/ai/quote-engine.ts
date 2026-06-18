import Anthropic from '@anthropic-ai/sdk'
import { AppSettings, QuoteEstimate, UrgencyLevel } from '@/types'

export interface ClarifyingQuestion {
  id: string
  question: string
  type: 'single_choice' | 'text'
  options?: string[]
}

export type QuoteAnswer = { id: string; answer: string }

interface QuoteInput {
  description: string
  job_type: string | null
  urgency: UrgencyLevel
  media_urls: string[]
  settings: AppSettings
  answers?: QuoteAnswer[]
}

export type QuoteResult =
  | { type: 'estimate'; estimate: QuoteEstimate }
  | { type: 'questions'; questions: ClarifyingQuestion[] }

function getClient(settings: AppSettings): Anthropic {
  const rawKey = settings.anthropic_api_key || process.env.ANTHROPIC_API_KEY
  if (!rawKey) throw new Error('No Anthropic API key configured. Add one in Settings → API Keys.')
  return new Anthropic({ apiKey: rawKey.replace(/^﻿/, '') })
}

function urgencyMult(urgency: UrgencyLevel, settings: AppSettings) {
  if (urgency === 'emergency') return settings.emergency_multiplier
  if (urgency === 'urgent') return settings.urgent_multiplier
  return 1.0
}

export async function generateQuote(input: QuoteInput): Promise<QuoteResult> {
  const { description, job_type, urgency, settings, answers } = input
  const client = getClient(settings)
  const multiplier = urgencyMult(urgency, settings)

  // If we have answers from the clarification step, skip straight to the estimate
  if (!answers || answers.length === 0) {
    const questions = await tryGetClarifyingQuestions(client, description, job_type, urgency)
    if (questions) return { type: 'questions', questions }
  }

  const answersText = answers?.length
    ? '\n\nCustomer answers to clarifying questions:\n' +
      answers.map(a => `- ${a.id}: ${a.answer}`).join('\n')
    : ''

  const systemPrompt = `You are an expert plumbing estimator for ${settings.business_name} based in ${settings.service_area}.

Current rates:
- Labor: $${settings.labor_rate_per_hour}/hour
- Parts markup: ${settings.parts_markup_percent}%
- Urgency multiplier (${urgency}): ${multiplier}x

Return ONLY a JSON object with this exact structure:
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
  "summary": "1-2 sentence plain-English summary",
  "confidence": "low" | "medium" | "high",
  "notes": "caveats as a newline-separated numbered list. Each item on its own line:\n1. First caveat\n2. Second caveat"
}

Rules:
- labor_cost = labor_hours * ${settings.labor_rate_per_hour} * ${multiplier}
- parts_cost includes ${settings.parts_markup_percent}% markup
- urgency_surcharge = dollar amount added for urgency (0 if standard)
- subtotal = labor_cost + parts_cost
- total = subtotal + urgency_surcharge
- Use realistic prices for ${settings.service_area}
- notes MUST be newline-separated numbered items. No inline (1) style lists.`

  const userMessage = `Job type: ${job_type || 'Not specified'}
Urgency: ${urgency}
Description: ${description}${answersText}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  if (response.stop_reason === 'max_tokens') {
    throw new Error('Estimate generation was cut short — please try again.')
  }

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not generate a valid estimate. Please try again.')

  try {
    return { type: 'estimate', estimate: JSON.parse(jsonMatch[0]) as QuoteEstimate }
  } catch {
    throw new Error('Could not parse the estimate. Please try again.')
  }
}

async function tryGetClarifyingQuestions(
  client: Anthropic,
  description: string,
  job_type: string | null,
  urgency: UrgencyLevel
): Promise<ClarifyingQuestion[] | null> {
  const systemPrompt = `You are a plumbing estimator's assistant. Your job is to decide whether a customer's job description has enough detail to generate an accurate quote, or whether a few quick questions would significantly improve accuracy.

If the description is already specific enough (e.g. mentions fixture type, location, home size, problem details), respond with:
{ "needs_clarification": false }

If the description is too vague and 2–4 targeted questions would meaningfully improve the estimate, respond with:
{
  "needs_clarification": true,
  "questions": [
    {
      "id": "short_snake_case_id",
      "question": "The question text shown to the customer",
      "type": "single_choice",
      "options": ["Option A", "Option B", "Option C"]
    },
    {
      "id": "another_id",
      "question": "Open-ended question",
      "type": "text"
    }
  ]
}

Guidelines:
- Only ask if it would genuinely change the estimate by 20%+
- 2 questions minimum, 4 maximum
- Prefer single_choice (faster for the user) — use text only for details that can't be captured with options
- Questions must be customer-friendly (no jargon)
- Do NOT ask for information already provided`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Job type: ${job_type || 'Not specified'}\nUrgency: ${urgency}\nDescription: ${description}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.needs_clarification) return null
    return parsed.questions as ClarifyingQuestion[]
  } catch {
    return null
  }
}
