-- alerts_tables.sql — create tables + RLS for daily alerts
create table if not exists public.equity_alerts (
  id               uuid primary key default gen_random_uuid(),
  pick_date        date not null default (timezone('America/Toronto', now()))::date,
  picked_at        timestamptz not null default now(),
  rank_order       int not null check (rank_order between 1 and 5),
  ticker           text not null,
  exchange         text,
  price            numeric,
  premarket_change_pct numeric,
  rel_vol          numeric,
  float_shares     bigint,
  news_recent_count int,
  atr_pct          numeric,
  yday_high        numeric,
  yday_low         numeric,
  target_growth_pct numeric,
  likelihood_of_win numeric,
  entry_price      numeric,
  stop_price       numeric,
  tp1_price        numeric,
  tp2_price       numeric,
  source           text default 'yfinance/yahooquery',
  unique (pick_date, rank_order, ticker)
);

create index if not exists equity_alerts_pickdate_idx on public.equity_alerts (pick_date desc);

create table if not exists public.crypto_alerts (
  id               uuid primary key default gen_random_uuid(),
  pick_date        date not null default (timezone('America/Toronto', now()))::date,
  picked_at        timestamptz not null default now(),
  rank_order       int not null check (rank_order between 1 and 5),
  symbol           text not null,
  price            numeric,
  change_24h_pct   numeric,
  rel_vol          numeric,
  news_recent_count int,
  atr_pct          numeric,
  yday_high        numeric,
  yday_low         numeric,
  target_growth_pct numeric,
  likelihood_of_win numeric,
  entry_price      numeric,
  stop_price       numeric,
  tp1_price        numeric,
  tp2_price        numeric,
  source           text default 'yfinance',
  unique (pick_date, rank_order, symbol)
);

create index if not exists crypto_alerts_pickdate_idx on public.crypto_alerts (pick_date desc);

alter table public.equity_alerts enable row level security;
alter table public.crypto_alerts  enable row level security;

create policy if not exists read_equity_alerts on public.equity_alerts for select using (true);
create policy if not exists read_crypto_alerts  on public.crypto_alerts  for select using (true);

-- service role inserts (set via Edge Function)
create policy if not exists service_insert_equity_alerts
  on public.equity_alerts for insert
  to service_role
  with check (true);

create policy if not exists service_insert_crypto_alerts
  on public.crypto_alerts for insert
  to service_role
  with check (true);