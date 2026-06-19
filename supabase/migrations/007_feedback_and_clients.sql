-- Quote feedback and learning system
CREATE TABLE public.quote_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE UNIQUE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  accuracy_rating int CHECK (accuracy_rating BETWEEN 1 AND 5),
  -- 1=way off, 3=close, 5=spot-on
  estimated_total numeric(10,2),
  actual_labor_cost numeric(10,2),
  actual_parts_cost numeric(10,2),
  actual_total numeric(10,2),
  variance_amount numeric(10,2) GENERATED ALWAYS AS (actual_total - estimated_total) STORED,
  variance_reason text,
  admin_notes text,
  ai_learning_summary text,
  tags text[] DEFAULT '{}'
);

ALTER TABLE public.quote_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access quote_feedback" ON public.quote_feedback
  USING (auth.role() = 'authenticated');

-- Add completed_date and actual cost fields to jobs if not present
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS actual_total numeric(10,2);

-- Invoice paid tracking (add paid_at if missing)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at timestamptz;
