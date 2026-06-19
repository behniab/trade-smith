-- Portfolio / past work gallery
create table public.portfolio (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null,
  description text not null,
  job_type text,
  completed_date date,
  labor_cost numeric(10,2),
  parts_cost numeric(10,2),
  total_cost numeric(10,2),
  emergent_issues text,
  explanation text,
  images jsonb default '[]'::jsonb,  -- array of { url, storage_path, caption }
  is_published boolean default true
);

alter table public.portfolio enable row level security;

-- Public can read published entries (for /gallery page)
create policy "Public read published portfolio" on public.portfolio
  for select using (is_published = true);

-- Authenticated admin has full access
create policy "Auth full access portfolio" on public.portfolio
  using (auth.role() = 'authenticated');

-- Storage bucket for portfolio images
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do nothing;

create policy "Public read portfolio storage" on storage.objects
  for select using (bucket_id = 'portfolio');

create policy "Auth upload portfolio storage" on storage.objects
  for insert with check (bucket_id = 'portfolio' and auth.role() = 'authenticated');

create policy "Auth delete portfolio storage" on storage.objects
  for delete using (bucket_id = 'portfolio' and auth.role() = 'authenticated');
