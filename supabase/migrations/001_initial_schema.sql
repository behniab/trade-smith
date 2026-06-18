-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  email text not null,
  phone text,
  address text,
  notes text
);

-- Jobs
create type public.job_status as enum (
  'requested', 'quoted', 'accepted', 'scheduled', 'in_progress', 'completed', 'cancelled'
);
create type public.urgency_level as enum ('standard', 'urgent', 'emergency');

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  client_id uuid references public.clients(id) on delete cascade,
  title text not null,
  description text not null,
  status public.job_status default 'requested',
  urgency public.urgency_level default 'standard',
  scheduled_date timestamptz,
  completed_date timestamptz,
  notes text
);

-- Quotes
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  job_id uuid references public.jobs(id) on delete cascade,
  estimate jsonb not null,
  ai_prompt_summary text,
  status text default 'pending' check (status in ('pending', 'sent', 'accepted', 'rejected'))
);

-- Media
create table public.media (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  job_id uuid references public.jobs(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  file_type text check (file_type in ('image', 'video')),
  caption text,
  is_gallery boolean default false
);

-- Invoices
create type public.invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  job_id uuid references public.jobs(id),
  client_id uuid references public.clients(id),
  quote_id uuid references public.quotes(id),
  amount numeric(10,2) not null,
  status public.invoice_status default 'draft',
  due_date date not null,
  paid_date date,
  stripe_payment_intent_id text,
  stripe_payment_url text,
  notes text
);

-- Job templates
create table public.job_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  estimated_hours numeric(4,1),
  common_parts text[],
  category text
);

-- App settings (single row)
create table public.settings (
  id int primary key default 1 check (id = 1),
  labor_rate_per_hour numeric(6,2) default 125.00,
  parts_markup_percent numeric(4,1) default 20.0,
  urgent_multiplier numeric(3,2) default 1.25,
  emergency_multiplier numeric(3,2) default 1.75,
  service_area text default 'United States',
  business_name text default 'Trade-Smith Plumbing',
  business_phone text default '',
  business_email text default '',
  business_address text default '',
  license_number text,
  stripe_enabled boolean default false
);

-- Seed one settings row
insert into public.settings (id) values (1);

-- Seed common job templates
insert into public.job_templates (name, description, estimated_hours, common_parts, category) values
  ('Fix leaking faucet', 'Repair or replace a dripping faucet', 1.5, ARRAY['faucet cartridge', 'O-rings', 'plumber''s grease'], 'repair'),
  ('Unclog drain', 'Clear a blocked sink, tub, or floor drain', 1.0, ARRAY['drain cleaner', 'drain snake'], 'repair'),
  ('Install toilet', 'Remove old and install new toilet', 2.5, ARRAY['toilet', 'wax ring', 'bolts', 'supply line'], 'installation'),
  ('Water heater replacement', 'Remove old and install new water heater', 4.0, ARRAY['water heater', 'supply lines', 'T&P valve', 'pipe fittings'], 'installation'),
  ('Fix running toilet', 'Repair internal toilet components', 1.0, ARRAY['fill valve', 'flapper', 'flush valve'], 'repair'),
  ('Install garbage disposal', 'Mount and wire a garbage disposal unit', 2.0, ARRAY['disposal unit', 'drain assembly', 'electrical connector'], 'installation'),
  ('Pipe burst repair', 'Locate and repair a burst or leaking pipe', 3.0, ARRAY['pipe section', 'couplings', 'pipe dope', 'teflon tape'], 'emergency'),
  ('Install dishwasher', 'Connect and test dishwasher supply and drain', 2.0, ARRAY['supply line', 'drain hose', 'hose clamps'], 'installation');

-- Enable RLS
alter table public.clients enable row level security;
alter table public.jobs enable row level security;
alter table public.quotes enable row level security;
alter table public.media enable row level security;
alter table public.invoices enable row level security;
alter table public.job_templates enable row level security;
alter table public.settings enable row level security;

-- Public read for job templates and settings (needed for quote form)
create policy "Public read job_templates" on public.job_templates for select using (true);
create policy "Public read settings" on public.settings for select using (true);

-- Authenticated full access for admin operations (adjust per auth strategy)
create policy "Auth full access clients" on public.clients using (auth.role() = 'authenticated');
create policy "Auth full access jobs" on public.jobs using (auth.role() = 'authenticated');
create policy "Auth full access quotes" on public.quotes using (auth.role() = 'authenticated');
create policy "Auth full access media" on public.media using (auth.role() = 'authenticated');
create policy "Auth full access invoices" on public.invoices using (auth.role() = 'authenticated');
create policy "Auth update settings" on public.settings using (auth.role() = 'authenticated');
