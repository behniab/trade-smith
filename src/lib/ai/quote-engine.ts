import Anthropic from '@anthropic-ai/sdk'
import { AppSettings, QuoteEstimate, PartsListData, UrgencyLevel } from '@/types'

export interface LearningInput {
  job_description: string
  job_type: string | null
  estimate: QuoteEstimate
  accuracy_rating: number
  actual_labor_cost: number | null
  actual_parts_cost: number | null
  actual_total: number
  estimated_total: number
  variance_reason: string | null
  admin_notes: string | null
  tags: string[]
  settings: AppSettings
}

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
  learnings?: string[]  // recent AI learning summaries injected from feedback
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
  const { description, job_type, urgency, settings, answers, learnings } = input
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
- notes MUST be newline-separated numbered items. No inline (1) style lists.${
    learnings?.length
      ? `\n\nLEARNINGS FROM PAST JOBS — apply these to calibrate your estimate:\n${learnings.map((l, i) => `${i + 1}. ${l}`).join('\n')}`
      : ''
  }`

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

export async function generatePartsList(
  estimate: QuoteEstimate,
  jobDescription: string,
  jobType: string | null,
  settings: AppSettings
): Promise<PartsListData | null> {
  const client = getClient(settings)
  const vendor = settings.preferred_vendor

  const vendorContext = vendor
    ? `The admin's preferred vendor is "${vendor.name}" located at ${vendor.address}${vendor.phone ? `, phone: ${vendor.phone}` : ''}. Source all parts from this vendor by default.`
    : `No preferred vendor is set. Recommend a local plumbing supply house (Ferguson, Hajoca, Winsupply, or HD Supply) near ${settings.service_area}.`

  const systemPrompt = `You are a plumbing supply procurement assistant for ${settings.business_name} based in ${settings.service_area}.

${vendorContext}

Given a plumbing job estimate, generate a detailed parts procurement list.

Return ONLY a JSON object with this structure:
{
  "preferred_vendor": ${vendor
    ? JSON.stringify({ name: vendor.name, address: vendor.address, phone: vendor.phone ?? '' })
    : `{ "name": "Ferguson Plumbing Supply", "address": "${settings.service_area} area", "phone": "" }`
  },
  "items": [
    {
      "name": "Specific product name with size/spec (e.g. 'SharkBite 1/2\\\" Push-to-Connect Coupling')",
      "quantity": 2,
      "unit": "ea.",
      "estimated_unit_cost": 8.99,
      "estimated_total": 17.98,
      "notes": "Optional: brand alternative or special order note"
    }
  ],
  "total_parts_cost": 0.00,
  "procurement_notes": "Any lead time, availability, or ordering notes"
}

Rules:
- Use real product names a plumber would search for (include size, material, connection type)
- Include ALL parts from the estimate, plus consumables (thread tape, flux, solder, etc.)
- Quantities should match or slightly exceed the estimate to account for waste
- Prices reflect trade/contractor pricing (10-20% below retail)
- total_parts_cost must equal the sum of all estimated_totals`

  const lineItemsSummary = estimate.line_items
    .map(i => `- ${i.description}: qty ${i.quantity} ${i.unit}`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Job type: ${jobType || 'Not specified'}
Description: ${jobDescription}

Estimate line items:
${lineItemsSummary}

Parts cost in estimate: $${(estimate.parts_cost ?? 0).toFixed(2)}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    return JSON.parse(jsonMatch[0]) as PartsListData
  } catch {
    return null
  }
}

export async function generateLearning(input: LearningInput): Promise<string> {
  const client = getClient(input.settings)
  const variance = input.actual_total - input.estimated_total
  const pct = input.estimated_total > 0 ? ((variance / input.estimated_total) * 100).toFixed(1) : '0'
  const direction = variance > 0 ? 'over' : variance < 0 ? 'under' : 'exact'

  const prompt = `A plumbing job was completed. Compare the estimate vs. actuals and write ONE concise learning insight (2-4 sentences) that will help improve future estimates for similar jobs. Focus on WHY the estimate was off, what was missed or misjudged, and how to correct it next time. Be specific and actionable.

Job type: ${input.job_type || 'Not specified'}
Job description: ${input.job_description}
Accuracy rating: ${input.accuracy_rating}/5
Estimated total: $${input.estimated_total?.toFixed(2)}
Actual total: $${input.actual_total?.toFixed(2)}
Variance: ${direction === 'exact' ? 'None' : `$${Math.abs(variance).toFixed(2)} ${direction} by ${Math.abs(parseFloat(pct))}%`}
${input.actual_labor_cost != null ? `Actual labor: $${input.actual_labor_cost.toFixed(2)}` : ''}
${input.actual_parts_cost != null ? `Actual parts: $${input.actual_parts_cost.toFixed(2)}` : ''}
${input.variance_reason ? `Admin noted: ${input.variance_reason}` : ''}
${input.admin_notes ? `Additional notes: ${input.admin_notes}` : ''}
${input.tags?.length ? `Tags: ${input.tags.join(', ')}` : ''}

Write the learning insight as a single plain-text paragraph. No JSON, no headers.`

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}
