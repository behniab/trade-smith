export type JobStatus =
  | 'requested'
  | 'quoted'
  | 'accepted'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export type UrgencyLevel = 'standard' | 'urgent' | 'emergency'

export interface Client {
  id: string
  created_at: string
  name: string
  email: string
  phone: string | null
  address: string | null
  notes: string | null
}

export interface Job {
  id: string
  created_at: string
  client_id: string
  title: string
  description: string
  status: JobStatus
  urgency: UrgencyLevel
  scheduled_date: string | null
  completed_date: string | null
  notes: string | null
  client?: Client
}

export interface QuoteLineItem {
  description: string
  quantity: number
  unit: string
  unit_cost: number
  total: number
}

export interface QuoteEstimate {
  line_items: QuoteLineItem[]
  labor_hours: number
  labor_cost: number
  parts_cost: number
  urgency_surcharge: number
  subtotal: number
  total: number
  summary: string
  confidence: 'low' | 'medium' | 'high'
  notes: string
}

export interface Quote {
  id: string
  created_at: string
  job_id: string
  estimate: QuoteEstimate
  ai_prompt_summary: string
  status: 'pending' | 'sent' | 'accepted' | 'rejected'
  job?: Job
}

export interface MediaFile {
  id: string
  created_at: string
  job_id: string
  storage_path: string
  public_url: string
  file_type: 'image' | 'video'
  caption: string | null
  is_gallery: boolean
}

export interface Invoice {
  id: string
  created_at: string
  job_id: string
  client_id: string
  quote_id: string | null
  amount: number
  status: InvoiceStatus
  due_date: string
  paid_date: string | null
  stripe_payment_intent_id: string | null
  stripe_payment_url: string | null
  notes: string | null
  job?: Job
  client?: Client
}

export interface JobTemplate {
  id: string
  name: string
  description: string
  estimated_hours: number
  common_parts: string[]
  category: string
}

export interface VendorInfo {
  name: string
  address: string
  phone: string
}

export interface PartItem {
  name: string
  quantity: number
  unit: string
  estimated_unit_cost: number
  estimated_total: number
  notes?: string
  vendor?: VendorInfo    // per-item override (null = use preferred vendor)
}

export interface PartsListData {
  preferred_vendor: VendorInfo | null
  items: PartItem[]
  total_parts_cost: number
  procurement_notes: string
}

export interface ClarifyingQuestion {
  id: string
  question: string
  type: 'single_choice' | 'text'
  options?: string[]
}

export interface AppSettings {
  labor_rate_per_hour: number
  parts_markup_percent: number
  urgent_multiplier: number
  emergency_multiplier: number
  service_area: string
  business_name: string
  business_phone: string
  business_email: string
  business_address: string
  license_number: string | null
  stripe_enabled: boolean
  anthropic_api_key?: string | null
  preferred_vendor?: VendorInfo | null
}
