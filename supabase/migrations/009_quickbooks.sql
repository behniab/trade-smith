ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qb_client_id text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qb_client_secret text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qb_realm_id text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qb_access_token text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qb_refresh_token text;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qb_token_expires_at timestamptz;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS qb_environment text DEFAULT 'sandbox';

-- Track QB IDs on local records
ALTER TABLE public.clients   ADD COLUMN IF NOT EXISTS qb_customer_id text;
ALTER TABLE public.invoices  ADD COLUMN IF NOT EXISTS qb_invoice_id text;
ALTER TABLE public.invoices  ADD COLUMN IF NOT EXISTS qb_synced_at timestamptz;

-- Extend sync_log with a source column so QB + WorkWave logs coexist
ALTER TABLE public.sync_log ADD COLUMN IF NOT EXISTS source text DEFAULT 'workwave';
