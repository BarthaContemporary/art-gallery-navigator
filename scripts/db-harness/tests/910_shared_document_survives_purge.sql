-- 0097 §1 (database-1): purging a work no longer deletes a document that is
-- also linked to other works. The document is detached from the purged work
-- and keeps its other links and the invoice pointers on them; a document
-- linked to the purged work alone still goes with it; a register move
-- detaches nothing.
\ir ../lib/helpers.sql
begin;
select t.make_user('admin@example.com', 'admin') as admin_id \gset
select t.make_user('staff@example.com', 'staff') as staff_id \gset

insert into public.pieces (title) values ('First work (duplicate)') returning id as a_id \gset
insert into public.pieces (title) values ('Second work') returning id as b_id \gset
insert into public.pieces (title) values ('Third work') returning id as c_id \gset

-- One purchase invoice for A, B and C, uploaded on A's own panel (piece_id =
-- A; the 0065 trigger links it to A) and linked to B and C from Documents.
insert into public.piece_documents (piece_id, doc_type, title, storage_path)
  values (:'a_id', 'purchase_invoice', 'Invoice 17', :'a_id' || '/inv17.pdf') returning id as shared_id \gset
insert into public.document_pieces (document_id, piece_id) values (:'shared_id', :'b_id'), (:'shared_id', :'c_id');
update public.piece_financials set purchase_invoice_document_id = :'shared_id' where piece_id in (:'b_id', :'c_id');
-- A's own certificate, linked to nothing else.
insert into public.piece_documents (piece_id, doc_type, title, storage_path)
  values (:'a_id', 'certificate', 'Certificate', :'a_id' || '/cert.pdf') returning id as own_id \gset
-- A registry document (no filing work) linked to A and B.
insert into public.piece_documents (piece_id, doc_type, title, storage_path)
  values (null, 'other', 'Exhibition loan form', 'documents/loan.pdf') returning id as reg_id \gset
insert into public.document_pieces (document_id, piece_id) values (:'reg_id', :'a_id'), (:'reg_id', :'b_id');

select set_config('t.a_id', :'a_id', true), set_config('t.b_id', :'b_id', true), set_config('t.c_id', :'c_id', true),
       set_config('t.shared_id', :'shared_id', true), set_config('t.own_id', :'own_id', true),
       set_config('t.reg_id', :'reg_id', true);

-- A was trashed 31 days ago; the nightly purge runs.
update public.pieces set deleted_at = now() - interval '31 days' where id = :'a_id';
select public.purge_deleted_pieces() as purged \gset
do $$
declare
  _a uuid := current_setting('t.a_id')::uuid;
  _b uuid := current_setting('t.b_id')::uuid;
  _c uuid := current_setting('t.c_id')::uuid;
  _shared uuid := current_setting('t.shared_id')::uuid;
begin
  if exists (select 1 from public.piece_ref where id = _a) then raise exception 'setup: A was not purged'; end if;
  if not exists (select 1 from public.piece_documents where id = _shared and piece_id is null) then
    raise exception 'the shared invoice went with the purged work (or kept its piece_id)';
  end if;
  if (select count(*) from public.document_pieces where document_id = _shared) <> 2
     or exists (select 1 from public.document_pieces where document_id = _shared and piece_id = _a) then
    raise exception 'the shared invoice should keep exactly its links to B and C';
  end if;
  if (select count(*) from public.piece_financials
       where piece_id in (_b, _c) and purchase_invoice_document_id = _shared) <> 2 then
    raise exception 'B and C lost their purchase invoice';
  end if;
  if exists (select 1 from public.piece_documents where id = current_setting('t.own_id')::uuid) then
    raise exception 'a document of the purged work alone should still go with it';
  end if;
  if not exists (select 1 from public.document_pieces where document_id = current_setting('t.reg_id')::uuid and piece_id = _b)
     or exists (select 1 from public.document_pieces where document_id = current_setting('t.reg_id')::uuid and piece_id = _a) then
    raise exception 'the registry document should keep its link to B only';
  end if;
end $$;

-- "Delete forever" from the Trash runs as the signed-in staff user, who
-- cannot see invoice rows: the shared invoice is still detached.
insert into public.pieces (title) values ('Staff duplicate') returning id as d_id \gset
insert into public.piece_documents (piece_id, doc_type, title, storage_path)
  values (:'d_id', 'sale_invoice', 'Sale invoice', :'d_id' || '/sale.pdf') returning id as sale_id \gset
insert into public.document_pieces (document_id, piece_id) values (:'sale_id', :'b_id');
select set_config('t.d_id', :'d_id', true), set_config('t.sale_id', :'sale_id', true);
select t.claims(:'staff_id');
set local role authenticated;
do $$
declare n integer;
begin
  delete from public.pieces where id = current_setting('t.d_id')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'setup: staff could not delete the work'; end if;
end $$;
reset role;
do $$ begin
  if not exists (select 1 from public.piece_documents
                  where id = current_setting('t.sale_id')::uuid and piece_id is null) then
    raise exception 'the shared sale invoice went with a work staff deleted';
  end if;
  if not exists (select 1 from public.document_pieces
                  where document_id = current_setting('t.sale_id')::uuid and piece_id = current_setting('t.b_id')::uuid) then
    raise exception 'the shared sale invoice lost its link to B';
  end if;
end $$;

-- A register move keeps the identity: the invoice stays filed on C.
insert into public.piece_documents (piece_id, doc_type, title, storage_path)
  values (:'c_id', 'condition_report', 'Condition', :'c_id' || '/cond.pdf') returning id as cond_id \gset
insert into public.document_pieces (document_id, piece_id) values (:'cond_id', :'b_id');
select set_config('t.cond_id', :'cond_id', true);
select t.claims(:'admin_id');
set local role authenticated;
select public.move_piece_ledger(:'c_id', 'external') as moved \gset
reset role;
do $$ begin
  if not exists (select 1 from public.external_pieces where id = current_setting('t.c_id')::uuid) then
    raise exception 'setup: C was not moved';
  end if;
  if (select piece_id from public.piece_documents where id = current_setting('t.cond_id')::uuid)
     is distinct from current_setting('t.c_id')::uuid then
    raise exception 'a register move detached a document';
  end if;
end $$;

-- The trigger function is not callable by anyone.
do $$ begin
  if has_function_privilege('authenticated', 'public.detach_shared_documents()', 'execute')
     or has_function_privilege('anon', 'public.detach_shared_documents()', 'execute') then
    raise exception 'detach_shared_documents is executable by signed-in users or anon';
  end if;
end $$;
rollback;
