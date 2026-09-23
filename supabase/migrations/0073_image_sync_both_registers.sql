-- ---------------------------------------------------------------------------
-- Image changes re-sync the work on the website for BOTH stock registers.
--
-- enqueue_piece_image_sync (0010) looked the work up in public.pieces only,
-- so a photograph added to a web-visible work in the external register never
-- queued a sync. piece_images.piece_id keys on piece_ref, which both tables
-- share, so check whichever holds the work.
-- ---------------------------------------------------------------------------

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
