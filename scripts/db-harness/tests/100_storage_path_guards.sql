-- 0090 (F6): signed-in users can only write storage paths in the shapes the
-- apps write; the service role and the image worker keep writing theirs, and
-- older rows in other shapes still save when other columns change.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset
select t.make_user('admin@example.com', 'admin') as admin_id \gset
insert into public.pieces (title) values ('Guarded work') returning id as piece_id \gset
insert into public.pieces (title) values ('Other work') returning id as other_piece_id \gset
insert into public.makers (display_name) values ('Guarded maker') returning id as maker_id \gset
insert into public.capture_batches default values returning id as batch_id \gset
insert into public.capture_works (batch_id) values (:'batch_id') returning id as work_id \gset
insert into public.capture_invoices default values returning id as invoice_id \gset
select gen_random_uuid() as image_id \gset
select gen_random_uuid() as file_id \gset

-- An older row in a shape the guard would refuse today (written as the
-- superuser, as a migration would have).
insert into public.piece_images (piece_id, storage_path_original, storage_path_display)
values (:'piece_id', :'piece_id' || '/legacy name.JPG', :'piece_id' || '/legacy.display.jpg')
returning id as legacy_image_id \gset

-- A reusable check: the statement must be refused as a check violation.
create function t.refused(_sql text) returns void language plpgsql as $$
begin
  execute _sql;
  raise exception 'not refused: %', _sql;
exception when check_violation then null;
end $$;
grant execute on function t.refused(text) to anon, authenticated, service_role;

select set_config('t.piece', :'piece_id', true), set_config('t.other_piece', :'other_piece_id', true),
       set_config('t.maker', :'maker_id', true), set_config('t.batch', :'batch_id', true),
       set_config('t.work', :'work_id', true), set_config('t.invoice', :'invoice_id', true),
       set_config('t.image', :'image_id', true), set_config('t.file', :'file_id', true),
       set_config('t.legacy', :'legacy_image_id', true);

-- ---- staff: the studio uploader's own writes work -------------------------
select t.claims(:'staff_id');
set local role authenticated;
do $$
declare p text := current_setting('t.piece'); i text := current_setting('t.image');
begin
  -- What image-uploader.tsx inserts.
  insert into public.piece_images (id, piece_id, role, sort_order, storage_path_original, file_size_bytes, processing_status)
  values (i::uuid, p::uuid, 'front', 0, p || '/' || i || '.heic', 1000, 'pending');
  -- Caption, order and retry on it, and on the older row, still save.
  update public.piece_images set caption = 'Front', sort_order = 1 where id = i::uuid;
  update public.piece_images set caption = 'Old photo', processing_status = 'pending'
   where id = current_setting('t.legacy')::uuid;
  -- Clearing the display path is fine.
  update public.piece_images set storage_path_display = null where id = current_setting('t.legacy')::uuid;
end $$;

-- ---- staff: paths that climb out, or point elsewhere, are refused ----------
do $$
declare p text := current_setting('t.piece'); i text := current_setting('t.image');
        o text := current_setting('t.other_piece');
begin
  perform t.refused(format($q$insert into public.piece_images (piece_id, storage_path_original)
    values (%L, %L)$q$, p, p || '/../../piece-documents/' || p || '/' || i || '.pdf'));
  perform t.refused(format($q$insert into public.piece_images (piece_id, storage_path_original)
    values (%L, %L)$q$, p, p || '/%2e%2e/x.jpg'));
  perform t.refused(format($q$insert into public.piece_images (piece_id, storage_path_original)
    values (%L, %L)$q$, p, o || '/' || i || '.jpg'));
  perform t.refused(format($q$update public.piece_images set storage_path_original = %L where id = %L$q$,
    p || '/' || i || '/../../x.jpg', i));
  perform t.refused(format($q$update public.piece_images set storage_path_display = %L where id = %L$q$,
    p || '/../../piece-documents/' || p || '/x.pdf', i));
  perform t.refused(format($q$update public.piece_images set storage_path_display = %L where id = %L$q$,
    p || '/' || gen_random_uuid() || '.jpg', i));
  -- Moving an image to another work leaves its paths under the old one.
  perform t.refused(format($q$update public.piece_images set piece_id = %L where id = %L$q$, o, i));
  -- Maker portraits: no signed-in user writes these directly.
  perform t.refused(format($q$update public.makers set portrait_path = %L where id = %L$q$,
    current_setting('t.maker') || '/../piece-documents/x.jpg', current_setting('t.maker')));
  perform t.refused(format($q$update public.makers set portrait_original_path = %L where id = %L$q$,
    '../kyc-documents/x.jpg', current_setting('t.maker')));
end $$;
-- Ordinary maker edits still save.
update public.makers set biography = 'Edited by staff' where id = :'maker_id';
reset role;

-- An admin is a signed-in user too: the same shapes apply.
select t.claims(:'admin_id');
set local role authenticated;
do $$ begin
  perform t.refused(format($q$update public.piece_images set storage_path_display = %L where id = %L$q$,
    '../piece-documents/x.pdf', current_setting('t.image')));
end $$;
reset role;

-- ---- capture: the capture app's own writes work, others are refused -------
select t.claims(:'staff_id');
set local role authenticated;
do $$
declare b text := current_setting('t.batch'); w text := current_setting('t.work');
        v text := current_setting('t.invoice'); f text := current_setting('t.file');
        pg uuid;
begin
  -- What /api/capture/work/[id]/photo and /api/capture/invoice/[id]/page write.
  insert into public.capture_photos (work_id, batch_id, storage_path, sort_order)
  values (w::uuid, b::uuid, 'works/' || b || '/' || w || '/' || f || '.jpg', 0);
  update public.capture_photos set is_label = true where work_id = w::uuid;
  insert into public.capture_invoice_pages (invoice_id, storage_path, page_no)
  values (v::uuid, 'invoices/' || v || '/' || f || '.jpg', 1) returning id into pg;
  update public.capture_invoice_pages set squared_path = 'invoices/' || v || '/' || gen_random_uuid() || '.jpg'
   where id = pg;

  perform t.refused(format($q$insert into public.capture_photos (work_id, batch_id, storage_path)
    values (%L, %L, %L)$q$, w, b, 'works/' || b || '/' || w || '/../../../piece-documents/x.pdf'));
  perform t.refused(format($q$insert into public.capture_photos (work_id, batch_id, storage_path)
    values (%L, %L, %L)$q$, w, b, '../piece-documents/' || f || '.pdf'));
  perform t.refused(format($q$update public.capture_photos set storage_path = %L where work_id = %L$q$,
    'cards/' || f || '.jpg', w));
  perform t.refused(format($q$update public.capture_invoice_pages set squared_path = %L where id = %L$q$,
    'invoices/' || v || '/../../kyc-documents/x.jpg', pg));
  perform t.refused(format($q$insert into public.capture_invoice_pages (invoice_id, storage_path)
    values (%L, %L)$q$, v, 'invoices/' || gen_random_uuid() || '/' || f || '.jpg'));
end $$;
reset role;

-- ---- trusted writers keep writing their own shapes -------------------------
-- The image worker sets the display master (and, on the live box before its
-- own role, ran as postgres; both are outside the guard).
set local role image_worker;
update public.piece_images
   set storage_path_display = piece_id || '/' || id || '.jpg', processing_status = 'done'
 where id = :'image_id';
reset role;
-- The service role: the portrait route and the capture push.
set local role service_role;
update public.makers
   set portrait_path = id || '/display-1760000000000.jpg',
       portrait_original_path = id || '/original-1760000000000.heic'
 where id = :'maker_id';
insert into public.piece_images (piece_id, role, sort_order, storage_path_original, processing_status)
values (:'piece_id', 'detail', 2, :'piece_id' || '/' || gen_random_uuid() || '.jpg', 'pending');
reset role;
do $$ begin
  if (select storage_path_display from public.piece_images where id = current_setting('t.image')::uuid)
     <> current_setting('t.piece') || '/' || current_setting('t.image') || '.jpg' then
    raise exception 'the image worker could not set the display path';
  end if;
  if (select portrait_path from public.makers where id = current_setting('t.maker')::uuid) is null then
    raise exception 'the service role could not set the portrait';
  end if;
end $$;

-- A staff edit of a maker whose portrait the route set still saves.
select t.claims(:'staff_id');
set local role authenticated;
update public.makers set life_dates = '1844–1915' where id = :'maker_id';
reset role;
rollback;
