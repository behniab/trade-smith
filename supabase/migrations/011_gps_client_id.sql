ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS gps_client_id text;
