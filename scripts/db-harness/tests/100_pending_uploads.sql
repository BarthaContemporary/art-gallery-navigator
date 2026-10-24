-- 0090 (F2): an upload path can be recorded once, by the user it was issued
-- to, for the record it was issued for, before it runs out; only the
-- service role (the studio's sign and commit routes) may touch the table.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('other@example.com', 'staff') as other_id \gset
select gen_random_uuid() as piece_id \gset
select gen_random_uuid() as shipment_id \gset

-- The service role issues and claims, exactly once.
set local role service_role;
select public.pending_upload_issue(:'staff_id', :'piece_id' || '/a.pdf', 'piece', :'piece_id');
select public.pending_upload_issue(:'staff_id', 'documents/b.pdf', 'document', null);
select public.pending_upload_issue(:'staff_id', 'shipments/' || :'shipment_id' || '/c.pdf', 'shipment', :'shipment_id');
\set piece_path :piece_id '/a.pdf'
\set ship_path 'shipments/' :shipment_id '/c.pdf'
do $$ begin
  if (select count(*) from public.pending_uploads) <> 3 then raise exception 'three issued uploads expected'; end if;
end $$;
-- Someone else, another record or another scope cannot claim it…
select public.pending_upload_claim(:'other_id', :'piece_path', 'piece', :'piece_id') as c \gset
\if :c
  do $$ begin raise exception 'another user claimed the upload'; end $$;
\endif
select public.pending_upload_claim(:'staff_id', :'piece_path', 'piece', gen_random_uuid()) as c \gset
\if :c
  do $$ begin raise exception 'claimed for another record'; end $$;
\endif
select public.pending_upload_claim(:'staff_id', :'piece_path', 'document', null) as c \gset
\if :c
  do $$ begin raise exception 'claimed under another scope'; end $$;
\endif
-- …the issuer can, once.
select public.pending_upload_claim(:'staff_id', :'piece_path', 'piece', :'piece_id') as c \gset
\if :c
\else
  do $$ begin raise exception 'the issuer could not claim the upload'; end $$;
\endif
select public.pending_upload_claim(:'staff_id', :'piece_path', 'piece', :'piece_id') as c \gset
\if :c
  do $$ begin raise exception 'the upload was claimed twice'; end $$;
\endif
-- A shared document has no record.
select public.pending_upload_claim(:'staff_id', 'documents/b.pdf', 'document', null) as c \gset
\if :c
\else
  do $$ begin raise exception 'a shared-document upload could not be claimed'; end $$;
\endif
-- A path never issued cannot be claimed.
select public.pending_upload_claim(:'staff_id', 'documents/never.pdf', 'document', null) as c \gset
\if :c
  do $$ begin raise exception 'claimed a path that was never issued'; end $$;
\endif
reset role;

-- An expired upload cannot be claimed, and the next issue sweeps it away.
update public.pending_uploads set expires_at = now() - interval '1 minute' where path = :'ship_path';
set local role service_role;
select public.pending_upload_claim(:'staff_id', :'ship_path', 'shipment', :'shipment_id') as c \gset
\if :c
  do $$ begin raise exception 'claimed an expired upload'; end $$;
\endif
select public.pending_upload_issue(:'staff_id', 'documents/d.pdf', 'document', null);
reset role;
do $$ begin
  if exists (select 1 from public.pending_uploads where expires_at < now()) then
    raise exception 'issuing did not sweep expired uploads';
  end if;
end $$;

-- Deleting the user removes their pending uploads.
delete from auth.users where id = :'staff_id';
do $$ begin
  if exists (select 1 from public.pending_uploads) then raise exception 'pending uploads outlived their user'; end if;
end $$;

-- Signed-in users and anon can neither read the table nor call the functions,
-- so nobody can issue themselves a claim on a path of their choosing.
select t.claims(:'other_id');
set local role authenticated;
do $$ begin
  if t.visible('public.pending_uploads') <> -1 then raise exception 'staff can read pending_uploads'; end if;
  begin
    insert into public.pending_uploads (path, user_id, scope) values ('documents/x.pdf', auth.uid(), 'document');
    raise exception 'staff could insert into pending_uploads';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pending_upload_issue(auth.uid(), 'documents/x.pdf', 'document', null);
    raise exception 'staff could call pending_upload_issue';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.pending_upload_claim(auth.uid(), 'documents/x.pdf', 'document', null);
    raise exception 'staff could call pending_upload_claim';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set local role anon;
do $$ begin
  if t.visible('public.pending_uploads') <> -1 then raise exception 'anon can read pending_uploads'; end if;
  begin
    perform public.pending_upload_issue(gen_random_uuid(), 'documents/x.pdf', 'document', null);
    raise exception 'anon could call pending_upload_issue';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
rollback;
