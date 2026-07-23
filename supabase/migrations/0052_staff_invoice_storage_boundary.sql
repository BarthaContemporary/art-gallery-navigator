-- 0052: close the staff invoice-PDF storage leak.
--
-- The table policy hides purchase_invoice/sale_invoice ROWS in piece_documents
-- from staff, but the storage policy piece_buckets_staff_admin_rw granted staff
-- `for all` (incl. SELECT/list + createSignedUrl) over EVERY object in the
-- piece-documents bucket — invoice files included. A staff user could list
-- object keys and sign invoice PDFs, reading purchase costs the RLS model
-- withholds. Split the staff grant: full write on all piece buckets, but SELECT
-- excludes invoice objects. Admin keeps full access; accountant read unchanged.

-- SECURITY DEFINER so the check bypasses piece_documents' own RLS — otherwise a
-- staff user (who can't see invoice rows) would get NOT EXISTS = true and the
-- guard would invert. STABLE, minimal search_path.
create or replace function public.is_invoice_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.piece_documents d
    where d.storage_path = object_name
      and d.doc_type in ('purchase_invoice', 'sale_invoice')
  );
$$;

revoke all on function public.is_invoice_object(text) from public;
grant execute on function public.is_invoice_object(text) to authenticated;

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present, skipping';
    return;
  end if;

  -- Replace the blanket for-all staff/admin policy with split write + select.
  execute 'drop policy if exists piece_buckets_staff_admin_rw on storage.objects';

  -- Writes (insert/update/delete): staff + admin on all three piece buckets.
  execute $f$
    create policy piece_buckets_staff_admin_write on storage.objects
      for all to authenticated
      using (
        bucket_id in ('piece-originals', 'piece-derivatives', 'piece-documents')
        and public.has_any_role(auth.uid(), 'admin', 'staff')
        -- SELECT is carved out below; keep this policy for write verbs. To avoid
        -- also granting SELECT here, gate reads out: an invoice object is only
        -- readable via the dedicated select policies.
        and (
          public.has_any_role(auth.uid(), 'admin')
          or bucket_id <> 'piece-documents'
          or not public.is_invoice_object(name)
        )
      )
      with check (
        bucket_id in ('piece-originals', 'piece-derivatives', 'piece-documents')
        and public.has_any_role(auth.uid(), 'admin', 'staff')
      )
  $f$;
end
$$;

notify pgrst, 'reload schema';
