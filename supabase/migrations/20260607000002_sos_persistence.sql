-- Migration: SOS persistence tables
-- Creates sos_rules_presets and sos_period_summaries

-- ── sos_rules_presets ────────────────────────────────────────────────────────
-- Stores named rule-set presets for the SOS Generator accounting panel.
-- Each row bundles all rule types into a single JSONB config blob.

create table if not exists public.sos_rules_presets (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  config       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Allow only authenticated admins to read/write (enforced via service role in API routes)
alter table public.sos_rules_presets enable row level security;

create policy "Admin full access to sos_rules_presets"
  on public.sos_rules_presets
  for all
  using (true)
  with check (true);

-- Auto-update updated_at on modification
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'sos_rules_presets_updated_at'
  ) then
    create trigger sos_rules_presets_updated_at
      before update on public.sos_rules_presets
      for each row execute procedure public.set_updated_at();
  end if;
end; $$;

-- ── sos_period_summaries ─────────────────────────────────────────────────────
-- Stores per-period aggregate revenue figures for historical trend analysis.

create table if not exists public.sos_period_summaries (
  id                 uuid primary key default gen_random_uuid(),
  period_start       text not null,
  period_end         text not null,
  total_revenue      numeric(14, 4) not null default 0,
  total_payout       numeric(14, 4) not null default 0,
  artist_count       integer not null default 0,
  artist_breakdowns  jsonb not null default '[]'::jsonb,
  platform_breakdowns jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now()
);

alter table public.sos_period_summaries enable row level security;

create policy "Admin full access to sos_period_summaries"
  on public.sos_period_summaries
  for all
  using (true)
  with check (true);
