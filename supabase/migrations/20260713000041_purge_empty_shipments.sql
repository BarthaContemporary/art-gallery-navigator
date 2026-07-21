-- 0041_purge_empty_shipments
-- Auto-cleanup for shipment entries (import / temporary import / export /
-- temporary export) that were created but never filled in: no attached
-- inventory items, no uploaded documents, and no details typed (date,
-- reference, notes, destination). Hard-deleted after a grace period (default
-- 2 days) so a half-started "New import" doesn't linger in the library.

create or replace function public.purge_empty_shipments(grace interval default '2 days')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with del as (
    delete from public.shipments s
    where s.created_at < now() - grace
      -- no details entered
      and s.shipment_date is null
      and coalesce(s.reference, '') = ''
      and coalesce(s.notes, '') = ''
      and coalesce(s.destination_country, '') = ''
      -- no related records
      and not exists (select 1 from public.piece_shipments ps where ps.shipment_id = s.id)
      and not exists (select 1 from public.shipment_documents sd where sd.shipment_id = s.id)
    returning 1
  )
  select count(*) into n from del;
  return n;
end;
$$;

notify pgrst, 'reload schema';
