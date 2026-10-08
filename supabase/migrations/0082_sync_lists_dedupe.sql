-- ---------------------------------------------------------------------------
-- 0082 — list sync: keep live lists current, and never queue a list twice.
--
-- A live list's membership follows its saved filters, so any edit to a
-- web-visible work (status, category, location, framing, text…) can move it
-- in or out. Re-queue every live list on any update of a web-visible work,
-- not only on visibility changes. Static lists keep the visibility-only rule
-- (their membership is explicit). To stop an autosave burst stacking rows,
-- a list is queued only when no unprocessed row for it exists.
-- ---------------------------------------------------------------------------

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
    _id := old.id; _visibility_changed := true; _was_or_is_visible := true;
  elsif tg_op = 'INSERT' then
    if not new.web_visible then return new; end if;
    _id := new.id; _visibility_changed := true; _was_or_is_visible := true;
  else
    _id := new.id;
    _visibility_changed := old.web_visible is distinct from new.web_visible
                        or old.deleted_at is distinct from new.deleted_at;
    _was_or_is_visible := old.web_visible or new.web_visible;
    if not _was_or_is_visible then return new; end if;
  end if;

  insert into public.sync_outbox (entity_type, entity_id, op)
  select 'list', l.id, 'upsert'
    from public.piece_lists l
   where (l.is_dynamic
          or (_visibility_changed and exists (
                select 1 from public.piece_list_items i where i.list_id = l.id and i.piece_id = _id)))
     and not exists (
       select 1 from public.sync_outbox o
        where o.entity_type = 'list' and o.entity_id = l.id and o.processed_at is null);
  return coalesce(new, old);
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
  if not exists (select 1 from public.sync_outbox o
                  where o.entity_type = 'list' and o.entity_id = _list and o.processed_at is null) then
    insert into public.sync_outbox (entity_type, entity_id, op) values ('list', _list, 'upsert');
  end if;
  return coalesce(new, old);
end;
$$;

notify pgrst, 'reload schema';
