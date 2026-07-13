-- 0012_rls
-- Row Level Security for every table.
--
-- Model (docs/BUILD_PLAN.md):
--   anon        : denied everywhere — RLS enabled, zero anon policies, and
--                 table privileges revoked. Public/token surfaces (offer
--                 pages, booking) go through server routes using the
--                 service-role key, never anon PostgREST.
--   admin       : full access everywhere.
--   staff       : full inventory / CRM / offers / appointments, but NO
--                 policy at all on piece_financials (commercial band renders
--                 only for privileged roles), and no invoice documents.
--   accountant  : read-only pieces + financials + invoice documents +
--                 reference tables + activity log. No CRM.
--
-- All triggers that write to restricted tables (financials auto-create,
-- activity log, location history, stock counters, sync outbox) are
-- SECURITY DEFINER, so staff actions still work.

-- ===========================================================================
-- 1. Enable RLS everywhere + admin full access on every table
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'invitations',
    'makers', 'categories', 'locations', 'pieces',
    'stock_number_counters',
    'exchange_rates', 'piece_financials',
    'piece_images', 'piece_documents', 'piece_location_history',
    'provenance_entries', 'exhibitions', 'piece_exhibitions',
    'consignments', 'consignment_items', 'enquiries', 'piece_watches',
    'piece_lists', 'piece_list_items',
    'crm_organizations', 'crm_contacts', 'crm_interactions',
    'crm_lists', 'crm_list_members', 'crm_campaigns',
    'crm_campaign_recipients', 'email_events', 'unsubscribe_tokens',
    'offers', 'offer_items', 'offer_recipients', 'offer_views',
    'appointment_types', 'availability_rules', 'appointments',
    'kyc_profiles', 'kyc_checks', 'kyc_documents',
    'orders', 'order_items',
    'activity_log', 'piece_embeddings', 'sync_outbox'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format($f$
      drop policy if exists admin_all on public.%I
    $f$, t);
    execute format($f$
      create policy admin_all on public.%I
        for all to authenticated
        using (public.has_role(auth.uid(), 'admin'))
        with check (public.has_role(auth.uid(), 'admin'))
    $f$, t);
  end loop;
end;
$$;

-- Defence in depth: anon gets no table privileges at all (RLS already denies
-- via absence of anon policies, but revoking removes the surface entirely).
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;

-- ===========================================================================
-- 2. Staff: full access on inventory / CRM / offers / appointments
--    (deliberately NOT: piece_financials, invoice documents, invitations,
--     kyc_documents, orders, stock counters, sync outbox, activity log)
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'pieces', 'makers', 'categories', 'locations',
    'piece_images', 'piece_location_history',
    'provenance_entries', 'exhibitions', 'piece_exhibitions',
    'consignments', 'consignment_items', 'enquiries',
    'piece_lists', 'piece_list_items',
    'crm_organizations', 'crm_contacts', 'crm_interactions',
    'crm_lists', 'crm_list_members', 'crm_campaigns',
    'crm_campaign_recipients', 'unsubscribe_tokens',
    'offers', 'offer_items', 'offer_recipients', 'offer_views',
    'appointment_types', 'availability_rules', 'appointments'
  ]
  loop
    execute format($f$
      drop policy if exists staff_all on public.%I
    $f$, t);
    execute format($f$
      create policy staff_all on public.%I
        for all to authenticated
        using (public.has_role(auth.uid(), 'staff'))
        with check (public.has_role(auth.uid(), 'staff'))
    $f$, t);
  end loop;
end;
$$;

-- Staff read-only extras (rates for pricing UI, email delivery status,
-- KYC status surfaced in CRM, embeddings for similar-works search).
do $$
declare
  t text;
begin
  foreach t in array array[
    'exchange_rates', 'email_events', 'kyc_profiles', 'kyc_checks',
    'piece_embeddings'
  ]
  loop
    execute format($f$
      drop policy if exists staff_select on public.%I
    $f$, t);
    execute format($f$
      create policy staff_select on public.%I
        for select to authenticated
        using (public.has_role(auth.uid(), 'staff'))
    $f$, t);
  end loop;
end;
$$;

-- ===========================================================================
-- 3. Accountant: read-only stock book surface, no CRM
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'pieces', 'piece_financials', 'makers', 'categories', 'locations',
    'exchange_rates', 'activity_log'
  ]
  loop
    execute format($f$
      drop policy if exists accountant_select on public.%I
    $f$, t);
    execute format($f$
      create policy accountant_select on public.%I
        for select to authenticated
        using (public.has_role(auth.uid(), 'accountant'))
    $f$, t);
  end loop;
end;
$$;

-- NOTE: the stock-book views expose seller/buyer names via crm_contacts.
-- The accountant intentionally has no crm_contacts policy, so those name
-- columns come back NULL for them (LEFT JOIN + security_invoker) — the
-- financial rows themselves remain fully visible.

-- ===========================================================================
-- 4. piece_documents: typed visibility.
--    Invoices (purchase_invoice / sale_invoice) -> admin + accountant only.
--    Everything else -> staff (+ admin via admin_all).
-- ===========================================================================
drop policy if exists staff_non_invoice_all on public.piece_documents;
create policy staff_non_invoice_all on public.piece_documents
  for all to authenticated
  using (
    public.has_role(auth.uid(), 'staff')
    and doc_type not in ('purchase_invoice', 'sale_invoice')
  )
  with check (
    public.has_role(auth.uid(), 'staff')
    and doc_type not in ('purchase_invoice', 'sale_invoice')
  );

drop policy if exists accountant_invoice_select on public.piece_documents;
create policy accountant_invoice_select on public.piece_documents
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'accountant')
    and doc_type in ('purchase_invoice', 'sale_invoice')
  );

-- ===========================================================================
-- 5. piece_watches: every authenticated user manages their own rows
-- ===========================================================================
drop policy if exists watches_select_own on public.piece_watches;
create policy watches_select_own on public.piece_watches
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists watches_insert_own on public.piece_watches;
create policy watches_insert_own on public.piece_watches
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists watches_delete_own on public.piece_watches;
create policy watches_delete_own on public.piece_watches
  for delete to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- 6. profiles: everyone signed in can read all (names in activity trails,
--    watches, "updated by"); users update only their own row.
-- ===========================================================================
drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ===========================================================================
-- 7. user_roles: users read their own roles; only admin writes (admin_all).
--    has_role() itself is SECURITY DEFINER, so policies never recurse here.
-- ===========================================================================
drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- 8. Storage policies (skipped gracefully when storage schema is absent)
-- ===========================================================================
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema not present, skipping storage.objects policies';
    return;
  end if;

  -- Piece buckets: staff + admin read/write
  execute $f$
    drop policy if exists piece_buckets_staff_admin_rw on storage.objects
  $f$;
  execute $f$
    create policy piece_buckets_staff_admin_rw on storage.objects
      for all to authenticated
      using (
        bucket_id in ('piece-originals', 'piece-derivatives', 'piece-documents')
        and public.has_any_role(auth.uid(), 'admin', 'staff')
      )
      with check (
        bucket_id in ('piece-originals', 'piece-derivatives', 'piece-documents')
        and public.has_any_role(auth.uid(), 'admin', 'staff')
      )
  $f$;

  -- Accountant: read piece-documents objects (invoice files; row metadata
  -- is already filtered to invoice types by the piece_documents policies).
  execute $f$
    drop policy if exists piece_documents_accountant_read on storage.objects
  $f$;
  execute $f$
    create policy piece_documents_accountant_read on storage.objects
      for select to authenticated
      using (
        bucket_id = 'piece-documents'
        and public.has_role(auth.uid(), 'accountant')
      )
  $f$;

  -- KYC documents: admin only (MLR-sensitive identity documents)
  execute $f$
    drop policy if exists kyc_documents_admin_only on storage.objects
  $f$;
  execute $f$
    create policy kyc_documents_admin_only on storage.objects
      for all to authenticated
      using (
        bucket_id = 'kyc-documents'
        and public.has_role(auth.uid(), 'admin')
      )
      with check (
        bucket_id = 'kyc-documents'
        and public.has_role(auth.uid(), 'admin')
      )
  $f$;
end;
$$;
