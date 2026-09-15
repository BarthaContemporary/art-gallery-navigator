-- ---------------------------------------------------------------------------
-- Website sync for makers (artists) and work images.
--
-- The public site now has an Artists section fed one way from the inventory:
-- each maker becomes a read-only `artist` document in the CMS, and each
-- web-visible work references its artist. A maker is published when it is
-- flagged `web_visible` or has at least one web-visible work (the sync route
-- decides; this migration only queues the work).
--
--   • makers.web_visible          — explicit opt-in for makers without stock
--   • sync_outbox rows 'maker'    — from the makers trigger and from the
--                                   pieces trigger (a work going live can make
--                                   its maker publishable)
--   • sanity_assets               — storage path → Sanity asset id, so the
--                                   route uploads each display master once
-- ---------------------------------------------------------------------------

alter table public.makers
  add column if not exists web_visible boolean not null default false;

-- Storage-path → Sanity image asset cache. The route consults it before an
-- upload and writes to it after; delete a row to force a re-upload.
create table if not exists public.sanity_assets (
  storage_path text primary key,          -- '<bucket>/<path>'
  asset_id     text not null,             -- 'image-<hash>-<w>x<h>-<fmt>'
  uploaded_at  timestamptz not null default now()
);

alter table public.sanity_assets enable row level security;

drop policy if exists admin_all on public.sanity_assets;
create policy admin_all on public.sanity_assets
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.sanity_assets from anon;

-- Makers: every change re-pushes the artist; a delete unpublishes it.
create or replace function public.enqueue_maker_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.sync_outbox (entity_type, entity_id, op)
    values ('maker', old.id, 'delete');
    perform pg_notify('sync_outbox', old.id::text);
    return old;
  end if;

  insert into public.sync_outbox (entity_type, entity_id, op)
  values ('maker', new.id, 'upsert');
  perform pg_notify('sync_outbox', new.id::text);
  return new;
end;
$$;

drop trigger if exists trg_makers_sync_outbox on public.makers;
create trigger trg_makers_sync_outbox
  after insert or update or delete on public.makers
  for each row execute function public.enqueue_maker_sync();

-- Pieces: same rules as before (0056), plus the maker is re-evaluated
-- whenever a work's visibility or maker changes.
create or replace function public.enqueue_piece_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _op text;
  _id uuid;
begin
  if coalesce(current_setting('jvb.ledger_move', true), '0') = '1' then
    return coalesce(new, old);    -- move_piece_ledger() enqueues once, itself
  end if;

  if tg_op = 'DELETE' then
    if not old.web_visible then
      return old;                 -- never published, nothing to sync
    end if;
    _op := 'delete';
    _id := old.id;
  elsif tg_op = 'INSERT' then
    if not new.web_visible then
      return new;
    end if;
    _op := 'upsert';
    _id := new.id;
  else -- UPDATE
    if new.web_visible then
      _op := 'upsert';            -- published now: push current state
    elsif old.web_visible then
      _op := 'delete';            -- just unpublished: remove from Sanity
    else
      return new;                 -- invisible before and after: ignore
    end if;
    _id := new.id;
  end if;

  insert into public.sync_outbox (entity_type, entity_id, op)
  values ('piece', _id, _op);

  -- The maker's published state depends on its web-visible works, so
  -- re-evaluate the maker(s) when a work appears, disappears, changes
  -- visibility or changes hands — not on every edit.
  if tg_op = 'DELETE' then
    if old.maker_id is not null then
      insert into public.sync_outbox (entity_type, entity_id, op)
      values ('maker', old.maker_id, 'upsert');
    end if;
  elsif tg_op = 'INSERT' then
    if new.maker_id is not null then
      insert into public.sync_outbox (entity_type, entity_id, op)
      values ('maker', new.maker_id, 'upsert');
    end if;
  elsif old.web_visible is distinct from new.web_visible
     or old.maker_id is distinct from new.maker_id then
    if old.maker_id is not null then
      insert into public.sync_outbox (entity_type, entity_id, op)
      values ('maker', old.maker_id, 'upsert');
    end if;
    if new.maker_id is not null and new.maker_id is distinct from old.maker_id then
      insert into public.sync_outbox (entity_type, entity_id, op)
      values ('maker', new.maker_id, 'upsert');
    end if;
  end if;

  perform pg_notify('sync_outbox', _id::text);

  return coalesce(new, old);
end;
$$;

notify pgrst, 'reload schema';
