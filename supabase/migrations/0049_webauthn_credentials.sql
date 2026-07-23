-- 0049: passkey (WebAuthn) credentials for studio login.
--
-- Passkeys are verified in the studio's API routes with a service-role
-- client; the table is therefore RLS-enabled with NO policies (deny all to
-- anon/authenticated). One row per enrolled authenticator (a Mac's Touch ID,
-- an iPhone's Face ID via iCloud Keychain, a hardware key…).

create table if not exists webauthn_credentials (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  credential_id  text not null unique,          -- base64url, as sent by the browser
  public_key     text not null,                 -- base64 COSE public key bytes
  counter        bigint not null default 0,
  transports     text[],
  device_label   text,
  created_at     timestamptz not null default now(),
  last_used_at   timestamptz
);

create index if not exists idx_webauthn_credentials_user on webauthn_credentials (user_id);

alter table webauthn_credentials enable row level security;

notify pgrst, 'reload schema';
