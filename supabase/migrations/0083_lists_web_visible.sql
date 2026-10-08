-- ---------------------------------------------------------------------------
-- 0083 — only lists marked for the website are published; cleaner queueing.
--
-- The Sanity dataset is public, so every inventory list (name, description,
-- membership) was being exposed — including internal worklists. A list now
-- carries web_visible (default off); only visible lists are pushed, and
-- switching one off removes its document. Queueing dedupes against pending,
-- unclaimed rows (a claimed row may already have read the old state) and
-- ignores the item cascade of a list being deleted.
-- ---------------------------------------------------------------------------

alter table public.piece_lists add column if not exists web_visible boolean not null default false;

create index if not exists idx_sync_outbox_pending_entity
  on public.sync_outbox (entity_type, entity_id)
  where processed_at is null and claimed_at is null;

create or replace function public.queue_list_sync(_list_id uuid, _op text default 'upsert')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.sync_outbox (entity_type, entity_id, op)
  select 'list', _list_id, _op
   where not exists (
     select 1 from public.sync_outbox o
      where o.entity_type = 'list' and o.entity_id = _list_id and o.op = _op
        and o.processed_at is null and o.claimed_at is null);
$$;

-- A list row: queue when it is on the website, or when it just left it (the
-- route deletes the document for a non-visible list).
create or replace function public.enqueue_list_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.web_visible then perform public.queue_list_sync(old.id, 'delete'); end if;
    return old;
  end if;
  if new.web_visible or (tg_op = 'UPDATE' and old.web_visible) then
    perform public.queue_list_sync(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_list_item_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _list uuid := coalesce(new.list_id, old.list_id);
begin
  -- Items cascading away with a deleted list need no push of their own.
  if exists (select 1 from public.piece_lists l where l.id = _list and l.web_visible) then
    perform public.queue_list_sync(_list);
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.enqueue_piece_lists_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
  _visibility_changed boolean := false;
  _was_or_is_visible boolean;
begin
  if tg_op = 'DELETE' then
    if not old.web_visible then return old; end if;
    _id := old.id; _visibility_changed := true;
  elsif tg_op = 'INSERT' then
    if not new.web_visible then return new; end if;
    _id := new.id; _visibility_changed := true;
  else
    _id := new.id;
    _visibility_changed := old.web_visible is distinct from new.web_visible
                        or old.deleted_at is distinct from new.deleted_at;
    _was_or_is_visible := old.web_visible or new.web_visible;
    if not _was_or_is_visible then return new; end if;
  end if;

  perform public.queue_list_sync(l.id)
    from public.piece_lists l
   where l.web_visible
     and (l.is_dynamic
          or (_visibility_changed and exists (
                select 1 from public.piece_list_items i where i.list_id = l.id and i.piece_id = _id)));
  return coalesce(new, old);
end;
$$;

notify pgrst, 'reload schema';
