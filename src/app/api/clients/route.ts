import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('clients')
    .select(`
      id, name, email, phone, address, notes, created_at,
      jobs (
        id, title, description, status, urgency, scheduled_date, completed_at, actual_total, created_at,
        quotes ( id, estimate, parts_list, status, created_at ),
        invoices ( id, amount, status, due_date, paid_at ),
        quote_feedback ( id, accuracy_rating, actual_total, variance_amount, variance_reason, ai_learning_summary, tags, admin_notes )
      )
    `)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data })
}
