alter table public.settings
  add column if not exists google_refresh_token text,
  add column if not exists google_calendar_id text;

alter table public.jobs
  add column if not exists google_event_id text,
  add column if not exists scheduled_end timestamptz;
