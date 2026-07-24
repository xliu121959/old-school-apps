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

create table if not exists public.auth_rate_limits (
  bucket text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.app_states enable row level security;
alter table public.auth_rate_limits enable row level security;

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

create or replace function public.consume_auth_attempt(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_record public.auth_rate_limits%rowtype;
  elapsed_seconds integer;
begin
  insert into public.auth_rate_limits (bucket, attempts)
  values (p_bucket, 0)
  on conflict (bucket) do nothing;

  select *
  into current_record
  from public.auth_rate_limits
  where bucket = p_bucket
  for update;

  elapsed_seconds := extract(epoch from (now() - current_record.window_started_at))::integer;
  if elapsed_seconds >= p_window_seconds then
    update public.auth_rate_limits
    set attempts = 1, window_started_at = now(), updated_at = now()
    where bucket = p_bucket;
    return query select true, 0;
    return;
  end if;

  if current_record.attempts >= p_limit then
    return query select false, greatest(1, p_window_seconds - elapsed_seconds);
    return;
  end if;

  update public.auth_rate_limits
  set attempts = attempts + 1, updated_at = now()
  where bucket = p_bucket;
  return query select true, 0;
  return;
end;
$$;

create or replace function public.clear_auth_attempts(p_bucket text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_rate_limits where bucket = p_bucket;
$$;

revoke all on table public.auth_rate_limits from anon, authenticated;
revoke all on function public.consume_auth_attempt(text, integer, integer) from public, anon, authenticated;
revoke all on function public.clear_auth_attempts(text) from public, anon, authenticated;
grant execute on function public.consume_auth_attempt(text, integer, integer) to service_role;
grant execute on function public.clear_auth_attempts(text) to service_role;
