-- 1) Create dividends table to store dividend events per ETF
create table if not exists public.dividends (
  id uuid primary key default gen_random_uuid(),
  etf_id uuid not null references public.etfs(id) on delete cascade,
  ticker text not null,
  ex_date date not null,
  pay_date date,
  amount numeric not null,
  cash_currency text not null default 'USD',
  created_at timestamptz not null default now(),
  unique (ticker, ex_date)
);

-- Enable RLS and allow public reads (no writes from clients)
alter table public.dividends enable row level security;
create policy if not exists "Dividends are publicly viewable"
  on public.dividends
  for select
  using (true);

-- (Optional) frequency metadata on ETFs
alter table public.etfs
  add column if not exists distribution_frequency text;  -- e.g., monthly, quarterly, semiannual, annual

-- 2) Enable required extensions for scheduling
create schema if not exists extensions;
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 3) Schedule the updater to run daily at 06:00 UTC
-- It will call the public edge function using anon key; function will validate and use service role internally
select
  cron.schedule(
    'dividend-updater-daily',
    '0 6 * * *',
    $$
    select net.http_post(
      url := 'https://lyjfwnlindbsbbwjzefh.supabase.co/functions/v1/dividend-updater',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5amZ3bmxpbmRic2Jid2p6ZWZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ4NzE4NjUsImV4cCI6MjA3MDQ0Nzg2NX0.Q_wRMC9drqrZgmlJwastuye2Juum4nK8mIA5NdldXu8"}'::jsonb,
      body := '{}'::jsonb
    );
    $$
  );