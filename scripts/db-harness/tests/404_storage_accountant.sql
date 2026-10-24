-- 0093 (F24): in the piece-documents bucket the accountant reads invoice
-- files and shipment files only; staff and admin access is unchanged.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('accountant@example.com', 'accountant') as acc_id \gset

insert into storage.buckets (id, name, public) values
  ('piece-documents', 'piece-documents', false), ('kyc-documents', 'kyc-documents', false)
  on conflict (id) do nothing;

insert into public.pieces (title) values ('Document test') returning id as piece_id \gset
insert into public.shipments (kind) values ('import') returning id as ship_id \gset
insert into public.piece_documents (piece_id, doc_type, title, storage_path) values
  (:'piece_id', 'purchase_invoice', 'Invoice',  :'piece_id' || '/inv.pdf'),
  (:'piece_id', 'sale_invoice',     'Sale',     'documents/sale.pdf'),
  (:'piece_id', 'correspondence',   'Letter',   :'piece_id' || '/letter.pdf'),
  (:'piece_id', 'condition_report', 'Report',   :'piece_id' || '/condition.pdf');
insert into public.shipment_documents (shipment_id, title, storage_path) values
  (:'ship_id', 'Import entry', 'shipments/' || :'ship_id' || '/entry.pdf');
insert into storage.objects (bucket_id, name) values
  ('piece-documents', :'piece_id' || '/inv.pdf'),
  ('piece-documents', 'documents/sale.pdf'),
  ('piece-documents', :'piece_id' || '/letter.pdf'),
  ('piece-documents', :'piece_id' || '/condition.pdf'),
  ('piece-documents', 'shipments/' || :'ship_id' || '/entry.pdf'),
  ('piece-documents', 'shipments/' || :'ship_id' || '/stray.pdf'),  -- no row: not a filed shipment document
  ('kyc-documents',   'passport.pdf');
select set_config('t.piece_id', :'piece_id', true), set_config('t.ship_id', :'ship_id', true);

-- Accountant: the two invoices and the filed shipment document.
select t.claims(:'acc_id');
set local role authenticated;
do $$
declare
  _seen text[];
begin
  select array_agg(name order by name) into _seen from storage.objects;
  if _seen is distinct from (select array_agg(x order by x) from unnest(array[
       'documents/sale.pdf',
       current_setting('t.piece_id') || '/inv.pdf',
       'shipments/' || current_setting('t.ship_id') || '/entry.pdf']) x) then
    raise exception 'accountant sees %', _seen;
  end if;
  -- …and cannot write.
  begin
    insert into storage.objects (bucket_id, name) values ('piece-documents', 'shipments/x/new.pdf');
    raise exception 'accountant could upload';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Staff: everything in the piece buckets except invoices (0052), never KYC.
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  if (select count(*) from storage.objects) <> 4 then
    raise exception 'staff should see letter, condition report and both shipment objects, saw %',
      (select array_agg(name) from storage.objects);
  end if;
  if exists (select 1 from storage.objects where name like '%inv.pdf' or name like '%sale.pdf' or bucket_id = 'kyc-documents') then
    raise exception 'staff sees an invoice or a KYC file';
  end if;
end $$;
reset role;

-- Admin: all of it.
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  if (select count(*) from storage.objects) <> 7 then raise exception 'admin should see all seven objects'; end if;
end $$;
reset role;

-- Anon: nothing.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
do $$ begin
  if t.visible('storage.objects') > 0 then raise exception 'anon can list storage objects'; end if;
end $$;
reset role;

-- Service role: all of it (it signs and moves files for the studio).
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$ begin
  if (select count(*) from storage.objects) <> 7 then raise exception 'service role should see all seven objects'; end if;
end $$;
reset role;
rollback;
