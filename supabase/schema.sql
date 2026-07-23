create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  subscription_status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  app_key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, app_key)
);

alter table public.profiles enable row level security;
alter table public.app_states enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their app state" on public.app_states;
create policy "Users can read their app state"
  on public.app_states for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their app state" on public.app_states;
create policy "Users can insert their app state"
  on public.app_states for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their app state" on public.app_states;
create policy "Users can update their app state"
  on public.app_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create index if not exists app_states_user_id_idx on public.app_states(user_id);
create index if not exists profiles_stripe_customer_id_idx on public.profiles(stripe_customer_id);
