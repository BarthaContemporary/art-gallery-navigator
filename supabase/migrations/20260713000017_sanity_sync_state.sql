-- ---------------------------------------------------------------------------
-- sanity_sync_state — per-entity record of the Supabase → Sanity push.
--
-- The studio route /api/sync/sanity upserts into this table (on conflict
-- entity_type,entity_id) to track which web-visible works have been pushed to
-- Sanity, the resulting Sanity document id, and the last error/timestamp. It
-- was referenced by the sync code but never had a migration; this adds it so a
-- fresh database rebuild is complete. Additive and idempotent.
-- ---------------------------------------------------------------------------

create table if not exists public.sanity_sync_state (
  entity_type      text not null,                 -- 'piece'
  entity_id        uuid not null,
  sanity_doc_id    text,                           -- e.g. work-<uuid>
  status           text not null default 'pending',-- 'ok' | 'error' | 'pending'
  error            text,
  last_pushed_hash text,                           -- content hash for change-skip
  last_pushed_at   timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

drop trigger if exists trg_sanity_sync_state_updated_at on public.sanity_sync_state;
create trigger trg_sanity_sync_state_updated_at
  before update on public.sanity_sync_state
  for each row execute function public.set_updated_at();

-- System/sync table: writes come from the service client (RLS-bypassing).
-- Enable RLS with an admin-only policy for defence in depth + manual admin
-- access, matching sync_outbox / activity_log.
alter table public.sanity_sync_state enable row level security;

drop policy if exists admin_all on public.sanity_sync_state;
create policy admin_all on public.sanity_sync_state
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.sanity_sync_state from anon;
