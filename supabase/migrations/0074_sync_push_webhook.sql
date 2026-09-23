-- ---------------------------------------------------------------------------
-- 0074 — push the website sync the moment something changes.
--
-- Until now the outbox was only drained by the studio's 10-minute cron. This
-- adds:
--   • sync_config      — where the studio lives and the secret the database
--                        presents when it calls it (RLS on, no policies: only
--                        the service role and triggers can read it).
--   • claimed_at       — outbox rows are claimed with SKIP LOCKED so the cron,
--                        the webhook and Admin → Resync can overlap safely.
--   • claim_sync_outbox(batch) — the claim RPC the studio route uses.
--   • trg_sync_outbox_push     — after an outbox insert, pg_net POSTs to
--                        /api/sync/sanity. A burst of inserts (autosave, a
--                        500-row resync) makes one call, not hundreds: the
--                        call is skipped when another unprocessed row was
--                        queued in the last 3 s — the route waits 4 s before
--                        reading so that earlier call picks the new rows up.
-- Idempotent; safe to re-run.
-- ---------------------------------------------------------------------------

create table if not exists public.sync_config (
  id          smallint primary key default 1 check (id = 1),
  studio_url  text not null,
  secret      text not null,
  updated_at  timestamptz not null default now()
);
alter table public.sync_config enable row level security;
revoke all on public.sync_config from anon, authenticated;
grant select on public.sync_config to service_role;

insert into public.sync_config (studio_url, secret)
values ('https://studio.joostvandenbergh.com', encode(gen_random_bytes(24), 'hex'))
on conflict (id) do nothing;

alter table public.sync_outbox add column if not exists claimed_at timestamptz;

create or replace function public.claim_sync_outbox(batch integer default 12)
returns table (id bigint, entity_type text, entity_id uuid, op text)
language sql
security definer
set search_path = public
as $$
  update public.sync_outbox o
     set claimed_at = now()
   where o.id in (
     select x.id from public.sync_outbox x
      where x.processed_at is null
        and (x.claimed_at is null or x.claimed_at < now() - interval '2 minutes')
      order by x.id
      limit greatest(1, least(batch, 100))
      for update skip locked)
  returning o.id, o.entity_type, o.entity_id, o.op;
$$;
revoke all on function public.claim_sync_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_sync_outbox(integer) to service_role;

create or replace function public.push_sync_outbox()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  cfg public.sync_config%rowtype;
begin
  -- Another unprocessed row queued moments ago already woke the studio; its
  -- call reads the outbox after a short settle and will include this row.
  if exists (
    select 1 from public.sync_outbox o
     where o.processed_at is null
       and o.id < new.id
       and o.created_at > now() - interval '3 seconds'
  ) then
    return new;
  end if;

  select * into cfg from public.sync_config where id = 1;
  if not found then return new; end if;

  begin
    perform net.http_post(
      url := cfg.studio_url || '/api/sync/sanity',
      body := jsonb_build_object('source', 'outbox', 'outbox_id', new.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-sync-secret', cfg.secret,
        'x-sync-source', 'outbox'),
      timeout_milliseconds := 60000);
  exception when others then
    -- Never let a webhook problem block the edit; the cron drains the outbox.
    raise notice 'sync push skipped: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists trg_sync_outbox_push on public.sync_outbox;
create trigger trg_sync_outbox_push
  after insert on public.sync_outbox
  for each row execute function public.push_sync_outbox();

notify pgrst, 'reload schema';
