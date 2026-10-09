-- 0086: a photograph queued for reprocessing does not re-sync its work yet.
--
-- enqueue_piece_image_sync fires on every piece_images update, so setting
-- processing_status back to 'pending' (a retry, or re-deriving masters at a
-- new size) pushed the work to the website at once, while the master was
-- excluded as not 'done': the work went out without that photograph and its
-- square tile was decided from the next one. The worker's own 'done' write
-- enqueues the work when the new master exists, which is the moment that
-- matters. Inserts and deletes still enqueue as before.

create or replace function public.enqueue_piece_image_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _piece_id    uuid;
  _web_visible boolean;
begin
  if tg_op = 'UPDATE' and new.processing_status in ('pending', 'processing') then
    return new;
  end if;

  _piece_id := coalesce(new.piece_id, old.piece_id);

  select coalesce(
           (select p.web_visible from public.pieces p where p.id = _piece_id),
           (select e.web_visible from public.external_pieces e where e.id = _piece_id),
           false)
    into _web_visible;

  if _web_visible then
    insert into public.sync_outbox (entity_type, entity_id, op)
    values ('piece', _piece_id, 'upsert');

    perform pg_notify('sync_outbox', _piece_id::text);
  end if;

  return coalesce(new, old);
end;
$$;

notify pgrst, 'reload schema';
