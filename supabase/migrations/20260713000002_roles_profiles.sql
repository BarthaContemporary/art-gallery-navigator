-- 0002_roles_profiles
-- Application roles, user profiles, invitations, and the has_role() helpers
-- that every RLS policy relies on.
--
-- Role model (docs/BUILD_PLAN.md):
--   admin      : the dealer — full access everywhere
--   staff      : full inventory/CRM/offers but NO access to piece_financials
--   accountant : read-only pieces + financials + stock-book views, no CRM

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.user_role as enum ('admin', 'staff', 'accountant');
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile per auth user; auto-created by trigger on auth.users.';

-- ---------------------------------------------------------------------------
-- User roles (a user may hold several roles)
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.user_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

comment on table public.user_roles is
  'Roles are stored in a separate table (never on profiles/JWT-mutable data) '
  'and read via SECURITY DEFINER helpers to avoid recursive RLS.';

-- ---------------------------------------------------------------------------
-- Invitations (invite-only auth; public signup is disabled in GoTrue)
-- ---------------------------------------------------------------------------
create table if not exists public.invitations (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  role        public.user_role not null default 'staff',
  invited_by  uuid references auth.users (id) on delete set null,
  token       text not null unique default encode(gen_random_bytes(18), 'hex'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Role-check helpers used by all RLS policies.
-- SECURITY DEFINER so they can read user_roles regardless of the caller's
-- own RLS visibility; search_path pinned to public to prevent hijacking.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(_user_id uuid, _role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = _role
  );
$$;

create or replace function public.has_any_role(_user_id uuid, variadic _roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = _user_id
      and ur.role = any (_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row whenever an auth user is created (invite accept).
-- SECURITY DEFINER: the trigger fires as the GoTrue role, which has no direct
-- INSERT grant on public.profiles.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Shared updated_at maintenance (moddatetime-style), used by later tables.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
