ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS workwave_api_key text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS workwave_territory_id text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS workwave_base_url text DEFAULT 'https://wwrm.workwave.com';

-- Track which local records have been synced to WorkWave
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS workwave_id text;
ALTER TABLE public.jobs    ADD COLUMN IF NOT EXISTS workwave_order_id text;
ALTER TABLE public.quotes  ADD COLUMN IF NOT EXISTS workwave_synced_at timestamptz;

-- Sync log
CREATE TABLE IF NOT EXISTS public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  entity_type text NOT NULL,   -- 'client' | 'job' | 'quote' | 'invoice' | 'calendar'
  entity_id uuid,
  direction text DEFAULT 'push',
  status text NOT NULL,        -- 'ok' | 'error' | 'pending'
  workwave_request_id text,
  error_message text,
  payload jsonb
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth full access sync_log" ON public.sync_log USING (auth.role() = 'authenticated');
