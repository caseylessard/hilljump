-- Create ETFs table to reflect new data model (including exchange)
create table if not exists public.etfs (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  name text not null,
  exchange text not null,
  total_return_1y numeric not null,
  yield_ttm numeric not null,
  avg_volume bigint not null,
  expense_ratio numeric not null,
  volatility_1y numeric not null,
  max_drawdown_1y numeric not null,
  aum bigint not null,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.etfs enable row level security;

-- Public read access (site is public-facing reference data)
create policy if not exists "ETFs are publicly viewable"
  on public.etfs
  for select
  using (true);

-- No insert/update/delete policies so writes are blocked for clients by default

-- Updated-at trigger function (idempotent)
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Attach trigger to etfs
create trigger if not exists update_etfs_updated_at
before update on public.etfs
for each row execute function public.update_updated_at_column();

-- Seed initial data matching the app's sample ETFs
insert into public.etfs (ticker, name, exchange, total_return_1y, yield_ttm, avg_volume, expense_ratio, volatility_1y, max_drawdown_1y, aum, category)
values
  ('TSLY', 'YieldMax TSLA Option Income ETF', 'NYSE Arca', 42.5, 54.0, 3200000, 0.99, 38.0, -24.0, 2100000000, 'YieldMax'),
  ('NVDY', 'YieldMax NVDA Option Income ETF', 'NYSE Arca', 39.1, 45.0, 2100000, 0.99, 35.0, -20.0, 1800000000, 'YieldMax'),
  ('APLY', 'YieldMax AAPL Option Income ETF', 'NYSE Arca', 22.8, 36.0, 850000, 0.99, 28.0, -18.0, 600000000, 'YieldMax'),
  ('AMDY', 'YieldMax AMD Option Income ETF', 'NYSE Arca', 31.4, 40.0, 600000, 0.99, 33.0, -22.0, 450000000, 'YieldMax'),
  ('QYLD', 'Global X NASDAQ 100 Covered Call', 'NASDAQ', 14.2, 12.0, 2200000, 0.60, 20.0, -12.0, 7000000000, 'Covered Call'),
  ('JEPI', 'JPMorgan Equity Premium Income', 'NYSE Arca', 18.7, 7.8, 5300000, 0.35, 14.0, -9.0, 33000000000, 'Income'),
  ('JEPQ', 'JPMorgan Nasdaq Equity Premium Income', 'NASDAQ', 21.3, 10.3, 4800000, 0.35, 17.0, -10.0, 13000000000, 'Income'),
  ('XYLD', 'Global X S&P 500 Covered Call', 'NYSE Arca', 12.1, 10.8, 900000, 0.60, 16.0, -11.0, 2500000000, 'Covered Call'),
  ('RYLD', 'Global X Russell 2000 Covered Call', 'NYSE Arca', 8.6, 12.2, 650000, 0.60, 22.0, -15.0, 1500000000, 'Covered Call'),
  ('DIVO', 'Amplify CWP Enhanced Dividend Income', 'NYSE Arca', 11.9, 4.9, 350000, 0.55, 12.0, -8.0, 3500000000, 'Dividend')
on conflict (ticker) do nothing;