-- Create portfolio positions table
create table public.portfolio_positions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  ticker text not null,
  shares numeric not null check (shares >= 0),
  created_at timestamptz not null default now(),
  unique(user_id, ticker)
);

-- Enable RLS
alter table public.portfolio_positions enable row level security;

-- Policies
create policy "Users can view own positions"
  on public.portfolio_positions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own positions"
  on public.portfolio_positions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update own positions"
  on public.portfolio_positions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own positions"
  on public.portfolio_positions
  for delete
  using (auth.uid() = user_id);

-- Helpful index
create index idx_portfolio_positions_user on public.portfolio_positions(user_id);
