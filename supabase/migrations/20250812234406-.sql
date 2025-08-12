-- Create profiles table for user preferences
create table if not exists public.profiles (
  id uuid primary key,
  first_name text,
  country text not null default 'CA' check (country in ('US','CA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- RLS policies: users can manage their own profile
create policy if not exists "Can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy if not exists "Can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy if not exists "Can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger to keep updated_at current
create trigger if not exists update_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();