-- 0031_passkeys
-- WebAuthn / passkey credentials for the Quick Capture app (apps/capture).
-- A passkey lets an already-signed-in user enrol their device once, then sign
-- in later with Face ID / Touch ID — no password typing. Email + password
-- stays as the fallback (needed to enrol the first passkey and for recovery).
--
-- The authentication flow runs server-side with the service role (there is no
-- session yet at sign-in), so these routes bypass RLS; the policies below just
-- let a signed-in user manage their own credentials from the app.

create table if not exists public.passkeys (
  id           text primary key,                 -- credential ID (base64url)
  user_id      uuid not null references auth.users (id) on delete cascade,
  public_key   text not null,                    -- COSE public key, base64
  counter      bigint not null default 0,        -- signature counter (clone detection)
  transports   text[] not null default '{}',
  device_label text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists idx_passkeys_user on public.passkeys (user_id);

alter table public.passkeys enable row level security;

drop policy if exists passkeys_self on public.passkeys;
create policy passkeys_self on public.passkeys
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists passkeys_admin on public.passkeys;
create policy passkeys_admin on public.passkeys
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

notify pgrst, 'reload schema';
