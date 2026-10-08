-- ---------------------------------------------------------------------------
-- 0081 — inventory lists on the website.
--
-- An event in the Studio can now point at inventory lists as well as at
-- individual works. Lists are pushed to Sanity as `workList` documents
-- (`list-<id>`) by the same outbox → /api/sync/sanity path as works and
-- makers, carrying references to the list's web-visible works. They are
-- re-queued when the list or its membership changes, and when a work's
-- visibility changes (static lists that contain it; every live list, whose
-- membership is computed at push time).
-- Idempotent; safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_list_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.sync_outbox (entity_type, entity_id, op) values ('list', old.id, 'delete');
    return old;
  end if;
  insert into public.sync_outbox (entity_type, entity_id, op) values ('list', new.id, 'upsert');
  return new;
end;
$$;

drop trigger if exists trg_piece_lists_sync_outbox on public.piece_lists;
create trigger trg_piece_lists_sync_outbox
  after insert or update or delete on public.piece_lists
  for each row execute function public.enqueue_list_sync();

create or replace function public.enqueue_list_item_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.sync_outbox (entity_type, entity_id, op)
  values ('list', coalesce(new.list_id, old.list_id), 'upsert');
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_piece_list_items_sync_outbox on public.piece_list_items;
create trigger trg_piece_list_items_sync_outbox
  after insert or update or delete on public.piece_list_items
  for each row execute function public.enqueue_list_item_sync();

-- A work appearing on or leaving the website changes what its lists show.
create or replace function public.enqueue_piece_lists_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  if tg_op = 'DELETE' then
    if not old.web_visible then return old; end if;
    _id := old.id;
  elsif tg_op = 'INSERT' then
    if not new.web_visible then return new; end if;
    _id := new.id;
  else
    if old.web_visible is not distinct from new.web_visible
       and old.deleted_at is not distinct from new.deleted_at then
      return new;
    end if;
    _id := new.id;
  end if;

  insert into public.sync_outbox (entity_type, entity_id, op)
  select 'list', l.id, 'upsert'
    from public.piece_lists l
   where l.is_dynamic
      or exists (select 1 from public.piece_list_items i where i.list_id = l.id and i.piece_id = _id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_pieces_lists_sync_outbox on public.pieces;
create trigger trg_pieces_lists_sync_outbox
  after insert or update or delete on public.pieces
  for each row execute function public.enqueue_piece_lists_sync();

drop trigger if exists trg_external_pieces_lists_sync_outbox on public.external_pieces;
create trigger trg_external_pieces_lists_sync_outbox
  after insert or update or delete on public.external_pieces
  for each row execute function public.enqueue_piece_lists_sync();

notify pgrst, 'reload schema';
