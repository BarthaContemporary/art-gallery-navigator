-- 0097_review_database_fixes
-- Database fixes from the code review of November 2026. Applied after
-- 0089–0096 (it replaces functions those define). Each section names its
-- finding; scripts/db-harness/tests/910–919 test them.
--
--   1. A document shared with other works survives the purge of the work it
--      was first filed on (database-1).
--   2. pieces_search ranks exact and stock-number matches first again: works
--      without a legacy number no longer jump the queue (database-3).
--   3. Renaming a maker, or changing its life dates, re-queues its
--      web-visible works, whose documents carry copies of those fields
--      (database-4, studio-api-b-3).
--   4. The 30-day purge of unconfirmed newsletter sign-ups leaves nothing of
--      the person in activity_log or email_events, and spares a sign-up the
--      gallery has started working with (database-5, database-7).
--   5. A contact under a legal hold cannot be hard-deleted (database-6).
--   6. The blank-draft purge no longer deletes drafts that hold data in
--      columns and tables its test did not look at (database-8).
--   7. Indexes for the Admin page's change log and the Resend webhook
--      (database-10).
--   8. One id cannot sit in both registers (database-11).
--   9. vw_pieces_all is rebuilt with every stock column (database-12).
--  10. Files of deleted photographs, documents, shipment papers and maker
--      portraits are queued for removal from storage, and removed by
--      /api/cron/storage-sweep once the database backups that could bring
--      their rows back have rotated out; files already orphaned before
--      this migration are queued once as it runs (database-9,
--      studio-pages-inventory-8, studio-pages-ops-6).
--
-- Not here, on purpose: trashed works stay in the stock-book views until the
-- owner and the accountant have checked them (owner decision 18).
--
-- Idempotent; safe to re-run.

-- ===========================================================================
-- 1. Shared documents outlive the work they were filed on (database-1)
-- ===========================================================================
-- piece_documents.piece_id (the work a file was uploaded on) still cascades
-- from piece_ref, as it did before documents went many-to-many. A document
-- that has since been linked to other works through document_pieces went
-- with the first work when that work was purged, and took every other
-- work's link with it. Now such a document is detached first (piece_id set
-- to null, like a document made in the Documents registry) and keeps its
-- other links; the purged work's own link still goes by the document_pieces
-- cascade. A document linked to no other work still goes with its work.
--
-- On piece_ref, not on the stock tables, so a register move (which deletes
-- a stock row but keeps the identity) detaches nothing. SECURITY DEFINER:
-- "Delete forever" runs as the signed-in user, and staff cannot see invoice
-- rows.
create or replace function public.detach_shared_documents()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.piece_documents d
     set piece_id = null
   where d.piece_id = old.id
     and exists (select 1 from public.document_pieces dp
                  where dp.document_id = d.id and dp.piece_id <> old.id);
  return old;
end;
$$;
revoke execute on function public.detach_shared_documents() from public, anon, authenticated;

drop trigger if exists trg_piece_ref_detach_shared_documents on public.piece_ref;
create trigger trg_piece_ref_detach_shared_documents
  before delete on public.piece_ref
  for each row execute function public.detach_shared_documents();

-- ===========================================================================
-- 2. pieces_search: null-safe ordering (database-3)
-- ===========================================================================
-- As in 0077, with the first two sort keys made null-safe. legacy_stock_number
-- is null for every work created since the FileMaker import, `false or null`
-- is null, and DESC sorts nulls first: those works came before exact matches
-- and before every legacy work, whatever ts_rank said.
create or replace function public.pieces_search(q text)
returns setof public.pieces
language sql
stable
set search_path = public
as $$
  with all_pieces as (
    select * from public.pieces
    union all
    select * from public.external_pieces
  )
  select p.*
  from all_pieces p
  left join public.makers m on m.id = p.maker_id
  where
    p.deleted_at is null
    and (
      p.search_vector @@ websearch_to_tsquery('english', q)
      or p.search_vector @@ websearch_to_tsquery('simple', q)
      or p.stock_number ilike '%' || q || '%'
      or p.legacy_stock_number ilike '%' || q || '%'
      or p.title ilike '%' || q || '%'
      or p.description ilike '%' || q || '%'
      or similarity(coalesce(p.title, ''), q) > 0.2
      or m.display_name ilike '%' || q || '%'
      or m.native_name ilike '%' || q || '%'
      or m.romanized_name ilike '%' || q || '%'
      or similarity(coalesce(m.display_name, ''), q) > 0.3
      or similarity(coalesce(m.romanized_name, ''), q) > 0.3
      or exists (
        select 1 from unnest(m.alt_names) an
        where an ilike '%' || q || '%' or similarity(an, q) > 0.3
      )
    )
  order by
    coalesce(p.stock_number = q or p.legacy_stock_number = q, false) desc,
    coalesce(p.stock_number ilike '%' || q || '%' or p.legacy_stock_number ilike '%' || q || '%', false) desc,
    ts_rank(p.search_vector,
            websearch_to_tsquery('english', q)
            || websearch_to_tsquery('simple', q)) desc,
    greatest(
      similarity(coalesce(p.title, ''), q),
      similarity(coalesce(m.display_name, ''), q),
      similarity(coalesce(m.romanized_name, ''), q)
    ) desc,
    p.stock_number;
$$;
-- Signed-in users search with their own session (security invoker).
revoke execute on function public.pieces_search(text) from public, anon;
grant execute on function public.pieces_search(text) to authenticated, service_role;

-- ===========================================================================
-- 3. A maker's name and dates reach its works on the website (database-4)
-- ===========================================================================
-- As in 0072, plus: each work document carries copies of its maker's name,
-- native name and life dates (maker, makerNative, makerLifeDates), which the
-- site prints beside the work and searches on, and only a 'piece' outbox row
-- rewrites them. So when one of the four fields the copies come from
-- changes, the maker's web-visible works in both registers are queued after
-- the maker (the sync builds artists first). Only those four fields: the
-- makers trigger also fires on every profile autosave, on the website switch
-- and on the sync's own portrait_focus write. A work already waiting
-- (unclaimed) is not queued twice, since a rename typed into the maker page
-- arrives as several debounced saves.
create or replace function public.enqueue_maker_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.sync_outbox (entity_type, entity_id, op)
    values ('maker', old.id, 'delete');
    perform pg_notify('sync_outbox', old.id::text);
    return old;
  end if;

  insert into public.sync_outbox (entity_type, entity_id, op)
  values ('maker', new.id, 'upsert');

  if tg_op = 'UPDATE'
     and (old.display_name, old.romanized_name, old.native_name, old.life_dates)
         is distinct from (new.display_name, new.romanized_name, new.native_name, new.life_dates) then
    insert into public.sync_outbox (entity_type, entity_id, op)
    select 'piece', w.id, 'upsert'
      from (select p.id from public.pieces p
             where p.maker_id = new.id and p.web_visible and p.deleted_at is null
            union
            select e.id from public.external_pieces e
             where e.maker_id = new.id and e.web_visible and e.deleted_at is null) w
     where not exists (
       select 1 from public.sync_outbox o
        where o.entity_type = 'piece' and o.entity_id = w.id and o.op = 'upsert'
          and o.processed_at is null and o.claimed_at is null)
     order by w.id;
  end if;

  perform pg_notify('sync_outbox', new.id::text);
  return new;
end;
$$;
revoke execute on function public.enqueue_maker_sync() from public, anon, authenticated;

-- ===========================================================================
-- 4. The purge of unconfirmed sign-ups (database-5, database-7)
-- ===========================================================================
-- Delivery events lose the address and the provider's payload: those linked
-- to the contacts' newsletter and offer rows, and any that name one of the
-- addresses (as a whole address, never as part of a longer one). One pass
-- over email_events for all of them. Shared by erase_contact() and
-- apply_retention() so the two cannot drift; internal (only those two call
-- it, as their owner).
create or replace function public.scrub_email_events(_contacts uuid[], _emails text[])
returns integer
language plpgsql
set search_path = public
as $$
declare
  _addrs text[];
  _n     integer;
begin
  _contacts := coalesce(_contacts, '{}');
  select coalesce(array_agg(distinct a.addr), '{}') into _addrs
    from (select nullif(lower(btrim(e)), '') as addr from unnest(coalesce(_emails, '{}')) e) a
   where a.addr is not null;
  if cardinality(_contacts) = 0 and cardinality(_addrs) = 0 then
    return 0;
  end if;

  update public.email_events ev
     set payload = jsonb_build_object('erased', true)
   where ev.campaign_recipient_id in (select r.id from public.crm_campaign_recipients r where r.contact_id = any (_contacts))
      or ev.offer_recipient_id in (select r.id from public.offer_recipients r where r.contact_id = any (_contacts))
      or (ev.payload -> 'data' ->> 'email_id') in (
           select r.resend_email_id from public.crm_campaign_recipients r
            where r.contact_id = any (_contacts) and r.resend_email_id is not null
           union all
           select r.resend_email_id from public.offer_recipients r
            where r.contact_id = any (_contacts) and r.resend_email_id is not null)
      or exists (
           select 1 from unnest(_addrs) a (addr)
            where strpos(lower(ev.payload::text), a.addr) > 0
              and (jsonb_path_exists(lower(ev.payload::text)::jsonb, '$.** ? (@ == $e)', jsonb_build_object('e', a.addr))
                   or exists (select 1
                                from regexp_matches(lower(ev.payload::text), '[a-z0-9._%+''-]+@[a-z0-9.-]+', 'g') m
                               where rtrim(m[1], '.') = a.addr)));
  get diagnostics _n = row_count;
  return _n;
end;
$$;
revoke execute on function public.scrub_email_events(uuid[], text[]) from public, anon, authenticated;

-- erase_contact() as in 0093, with the email_events scrub moved into the
-- shared helper above. Nothing else changes.
create or replace function public.erase_contact(_contact uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _holds  text[];
  _email  text;
  _caller text;
  _result jsonb;
begin
  -- The studio's server action checks the admin role, then calls this with
  -- the service client (see 0093). Signed-in sessions have no EXECUTE; the
  -- admin test stays as a second line should that grant ever come back.
  _caller := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.jwt.claim.role', true), ''));
  if _caller is distinct from 'service_role' and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only an admin can erase a contact';
  end if;
  if not exists (select 1 from public.crm_contacts where id = _contact) then
    return jsonb_build_object('mode', 'missing');
  end if;

  _holds := public.contact_legal_holds(_contact);
  select nullif(lower(btrim(email)), '') into _email from public.crm_contacts where id = _contact;

  -- Nothing written below goes back into the change log (log_activity()).
  perform set_config('jvb.erasing_contact', _contact::text, true);

  -- Delivery events keep their type and date but lose the address and the
  -- rest of the provider's payload. Done before the recipient rows go, while
  -- they still link the events to this contact.
  perform public.scrub_email_events(array[_contact], case when _email is null then '{}'::text[] else array[_email] end);

  -- Everything that is personal and not under hold goes, in either mode.
  delete from public.crm_interactions where contact_id = _contact;
  delete from public.crm_list_members where contact_id = _contact;
  delete from public.crm_campaign_recipients where contact_id = _contact;
  delete from public.unsubscribe_tokens where contact_id = _contact;
  delete from public.offer_recipients where contact_id = _contact;
  update public.appointments set contact_id = null, name = 'Erased', email = null, phone = null, notes = null where contact_id = _contact;
  update public.enquiries set contact_id = null, message = '[erased at the data subject''s request]' where contact_id = _contact;

  if coalesce(array_length(_holds, 1), 0) = 0 then
    delete from public.crm_contacts where id = _contact;
    _result := jsonb_build_object('mode', 'deleted', 'holds', '[]'::jsonb);
  else
    -- Under hold: pseudonymise. The row stays so the retained accounting and
    -- AML records keep their reference; nothing identifying remains on it.
    update public.crm_contacts set
      first_name = 'Erased contact',
      last_name = left(_contact::text, 8),
      salutation = null,
      email = null, phone = null,
      address_line1 = null, address_line2 = null, city = null, postcode = null, country = null,
      instagram_handle = null, whatsapp_number = null, line_id = null, wechat_id = null,
      tags = '{}', interested_regions = '{}', custom_fields = '{}'::jsonb, notes = null,
      marketing_consent = false, consent_evidence = null, consent_confirm_token = null,
      do_not_mail = true, unsubscribed_at = coalesce(unsubscribed_at, now()),
      erased_at = now()
    where id = _contact;
    _result := jsonb_build_object('mode', 'anonymised', 'holds', to_jsonb(_holds));
  end if;

  -- And what was logged about them before: the full row when they were
  -- added, and every edit since.
  delete from public.activity_log where entity_type = 'crm_contacts' and entity_id = _contact;

  perform set_config('jvb.erasing_contact', '', true);
  return _result;
end;
$$;
revoke execute on function public.erase_contact(uuid) from public, anon, authenticated;
grant execute on function public.erase_contact(uuid) to service_role;

-- apply_retention() as in 0096, except for the unconfirmed_signups branch:
--   • database-7: a sign-up the gallery has started working with stays. On
--     top of the holds, enquiries, appointments and interactions it already
--     checked: no private offer, list membership, newsletter send or
--     data-subject request for the contact, no tag but the website's own,
--     no contact details, notes, organisation, interests, custom fields or
--     due-diligence status. Explicit signs rather than "updated since the
--     sign-up", which any later bulk update would trip for every row.
--   • database-5: the delete leaves nothing of the person behind. The
--     change log loses the contact's entries (the sign-up as it arrived and
--     the delete itself, written as the rows go), and delivery events of the
--     confirmation emails lose the address, as erase_contact() does.
-- The key and its count in the result are unchanged (Admin → Data
-- protection and retention_runs read them).
create or replace function public.apply_retention()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  _d integer; _n integer; _out jsonb := '{}'::jsonb;
  _ids uuid[]; _emails text[];
begin
  select days into _d from public.retention_policies where key = 'email_events' and mode = 'purge';
  if _d is not null then
    delete from public.email_events where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('email_events', _n);
  end if;

  select days into _d from public.retention_policies where key = 'offer_views' and mode = 'purge';
  if _d is not null then
    delete from public.offer_views where viewed_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('offer_views', _n);
  end if;

  select days into _d from public.retention_policies where key = 'campaign_recipients' and mode = 'purge';
  if _d is not null then
    delete from public.crm_campaign_recipients where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('campaign_recipients', _n);
  end if;

  select days into _d from public.retention_policies where key = 'enquiries' and mode = 'purge';
  if _d is not null then
    delete from public.enquiries where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('enquiries', _n);
  end if;

  select days into _d from public.retention_policies where key = 'appointments' and mode = 'purge';
  if _d is not null then
    delete from public.appointments where coalesce(ends_at, starts_at, created_at) < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('appointments', _n);
  end if;

  select days into _d from public.retention_policies where key = 'unconfirmed_signups' and mode = 'purge';
  if _d is not null then
    -- A sign-up that was never confirmed, that nothing holds, and that
    -- nobody at the gallery has worked with.
    with cand as (
      select c.id, nullif(lower(btrim(c.email)), '') as email
        from public.crm_contacts c
       where c.consent_confirm_token is not null
         and not c.marketing_consent
         and c.consent_confirm_sent_at < now() - make_interval(days => _d)
         and coalesce(array_length(public.contact_legal_holds(c.id), 1), 0) = 0
         and not exists (select 1 from public.enquiries e where e.contact_id = c.id)
         and not exists (select 1 from public.appointments a where a.contact_id = c.id)
         and not exists (select 1 from public.crm_interactions i where i.contact_id = c.id)
         and not exists (select 1 from public.offer_recipients r where r.contact_id = c.id)
         and not exists (select 1 from public.crm_list_members m where m.contact_id = c.id)
         and not exists (select 1 from public.crm_campaign_recipients r where r.contact_id = c.id)
         and not exists (select 1 from public.dp_requests q where q.contact_id = c.id)
         and c.tags <@ array['newsletter', 'website']::text[]
         and c.kyc_status = 'not_started'
         and c.custom_fields = '{}'::jsonb
         and c.interested_regions = '{}'::text[]
         and c.organization_id is null
         and btrim(concat(c.salutation, c.phone, c.address_line1, c.address_line2, c.city, c.postcode,
                          c.country, c.instagram_handle, c.whatsapp_number, c.line_id, c.wechat_id,
                          c.notes)) = ''
       for update
    )
    select coalesce(array_agg(cand.id), '{}'), coalesce(array_agg(cand.email) filter (where cand.email is not null), '{}')
      into _ids, _emails
      from cand;

    if cardinality(_ids) > 0 then
      perform public.scrub_email_events(_ids, _emails);
      with del as (delete from public.crm_contacts c where c.id = any (_ids) returning c.id)
      select coalesce(array_agg(del.id), '{}') into _ids from del;
      delete from public.activity_log where entity_type = 'crm_contacts' and entity_id = any (_ids);
    end if;
    _out := _out || jsonb_build_object('unconfirmed_signups', cardinality(_ids));
  end if;

  select days into _d from public.retention_policies where key = 'activity_log' and mode = 'purge';
  if _d is not null then
    delete from public.activity_log where created_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('activity_log', _n);
  end if;

  select days into _d from public.retention_policies where key = 'rate_limit_hits' and mode = 'purge';
  if _d is not null then
    delete from public.rate_limit_hits where at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('rate_limit_hits', _n);
  end if;

  -- Short-lived security records: unclaimed upload slips (0090), unused
  -- passkey challenges (0092).
  select days into _d from public.retention_policies where key = 'security_tokens' and mode = 'purge';
  if _d is not null then
    delete from public.pending_uploads where expires_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('pending_uploads', _n);
    delete from public.webauthn_challenges where expires_at < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('webauthn_challenges', _n);
  end if;

  -- A newsletter confirmation asked for on an existing contact's behalf and
  -- never confirmed (0095): its link has expired, so the pending entry goes.
  select days into _d from public.retention_policies where key = 'pending_optins' and mode = 'purge';
  if _d is not null then
    update public.crm_contacts
       set consent_evidence = consent_evidence - 'marketing_pending'
     where consent_evidence ? 'marketing_pending'
       and coalesce((consent_evidence -> 'marketing_pending' ->> 'at')::timestamptz, '-infinity'::timestamptz)
           < now() - make_interval(days => _d);
    get diagnostics _n = row_count; _out := _out || jsonb_build_object('pending_optins', _n);
  end if;

  return _out || jsonb_build_object('ran_at', now());
end;
$$;
revoke execute on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to service_role;

-- ===========================================================================
-- 5. A contact under a legal hold is never hard-deleted (database-6)
-- ===========================================================================
-- kyc_profiles cascade from the contact, and sales, purchases, consignments,
-- orders and consignee links are set null, so a plain delete wiped exactly
-- the records contact_legal_holds() names as reasons to keep it. Only
-- erase_contact() and the retention job consulted the holds; the capture
-- app's "recent contacts" delete and a staff session's direct delete did
-- not. Both of those callers delete only when there is no hold, so they are
-- unaffected. Raised as 23503 (PostgREST answers 409) with the holds in the
-- message.
create or replace function public.refuse_held_contact_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _holds text[] := public.contact_legal_holds(old.id);
begin
  if coalesce(array_length(_holds, 1), 0) > 0 then
    raise exception 'This contact cannot be deleted: %', array_to_string(_holds, '; ')
      using errcode = '23503',
            hint = 'Erase the contact from the studio instead: what the law requires is kept, the rest removed.';
  end if;
  return old;
end;
$$;
revoke execute on function public.refuse_held_contact_delete() from public, anon, authenticated;

drop trigger if exists trg_crm_contacts_hold_guard on public.crm_contacts;
create trigger trg_crm_contacts_hold_guard
  before delete on public.crm_contacts
  for each row execute function public.refuse_held_contact_delete();

-- ===========================================================================
-- 6. What counts as a blank draft (database-8)
-- ===========================================================================
-- As in 0093 (grace never under an hour), with the test extended to every
-- column the record editor and its panels write, the financial columns typed
-- by hand, and the tables a draft can be added to before it has a title.
-- Each column is checked against its default and exists on both stock
-- tables (the same text runs over each). The currencies and rates are not
-- tested: the autosave always writes GBP and 1, so they say nothing.
create or replace function public.purge_blank_draft_pieces(grace interval default '2 hours')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _blank constant text := $pred$
        p.deleted_at is null
    and p.created_at < now() - $1
    -- descriptive / cataloguing fields all empty
    and p.title is null
    and p.maker_id is null
    and p.attribution_qualifier is null
    and p.category_id is null
    and p.location_id is null
    and p.year is null
    and p.medium is null
    and p.period is null
    and p.origin_region is null
    and p.description is null
    and p.condition_report is null
    and p.signature_inscription is null
    and p.box_type is null and p.box_notes is null
    and p.dimensions_display is null
    and p.height_cm is null and p.width_cm is null and p.depth_cm is null
    and p.length_cm is null and p.diameter_cm is null and p.weight_g is null
    and p.framed = false
    and p.unframed_height_cm is null and p.unframed_width_cm is null and p.unframed_depth_cm is null
    and p.unframed_length_cm is null and p.unframed_diameter_cm is null and p.unframed_weight_g is null
    and p.status = 'in_stock'
    and p.presentation = 'auto'
    and p.photographer is null
    and p.consignee_contact_id is null
    and coalesce(p.comments, '') = ''
    and coalesce(p.source_note, '') = ''
    and coalesce(p.purchased_from, '') = ''
    and coalesce(p.sold_to, '') = ''
    and coalesce(p.shares_note, '') = ''
    and coalesce(p.consignment_details, '') = ''
    and coalesce(p.published_note, '') = ''
    and coalesce(p.document_note, '') = ''
    and p.consignment_share_pct is null
    and p.sale_handled_by_jvb is null
    and (p.publications is null or p.publications = '[]'::jsonb)
    and (p.exhibitions is null or p.exhibitions = '[]'::jsonb)
    and coalesce(array_length(p.tags, 1), 0) = 0
    and p.web_visible = false
    -- no related records
    and not exists (select 1 from public.piece_images       pi where pi.piece_id = p.id)
    and not exists (select 1 from public.document_pieces    dp where dp.piece_id = p.id)
    and not exists (select 1 from public.piece_shipments    ps where ps.piece_id = p.id)
    and not exists (select 1 from public.provenance_entries pe where pe.piece_id = p.id)
    and not exists (select 1 from public.piece_list_items   li where li.piece_id = p.id)
    and not exists (select 1 from public.offer_items        oi where oi.piece_id = p.id)
    and not exists (select 1 from public.piece_exhibitions  px where px.piece_id = p.id)
    and not exists (select 1 from public.consignment_items  ci where ci.piece_id = p.id)
    and not exists (select 1 from public.order_items        ri where ri.piece_id = p.id)
    and not exists (select 1 from public.enquiries          en where en.piece_id = p.id)
    -- no financial data entered
    and not exists (
      select 1 from public.piece_financials f
      where f.piece_id = p.id
        and (f.purchase_cost is not null
             or f.purchase_cost_gbp is not null
             or f.purchase_date is not null
             or f.marked_price_gbp is not null
             or f.sold_price is not null
             or f.sold_price_gbp is not null
             or f.sold_date is not null
             or f.restoration_cost_gbp <> 0
             or f.other_costs_gbp <> 0
             or f.vat_treatment <> 'margin_scheme'
             or f.import_type is not null
             or f.import_vat_gbp is not null
             or f.seller_contact_id is not null
             or f.buyer_contact_id is not null
             or f.consignment_id is not null
             or f.purchase_invoice_document_id is not null
             or f.sale_invoice_document_id is not null)
    )
  $pred$;
  _tbl   text;
  _n     integer;
  _total integer := 0;
begin
  grace := greatest(coalesce(grace, interval '2 hours'), interval '1 hour');
  foreach _tbl in array array['pieces', 'external_pieces'] loop
    execute format(
      'with del as (delete from public.%I p where %s returning 1) select count(*) from del',
      _tbl, _blank)
      using grace
      into _n;
    _total := _total + _n;
  end loop;
  return _total;
end;
$$;
revoke execute on function public.purge_blank_draft_pieces(interval) from public, anon, authenticated;
grant execute on function public.purge_blank_draft_pieces(interval) to service_role;

-- ===========================================================================
-- 7. Indexes (database-10)
-- ===========================================================================
-- Admin reads the newest entries of the whole change log, and the retention
-- job deletes by age: both sorted the table. The Resend webhook looks up a
-- send by the provider's email id once per delivery event.
create index if not exists idx_activity_log_created
  on public.activity_log (created_at desc);
create index if not exists idx_crm_campaign_recipients_resend_email
  on public.crm_campaign_recipients (resend_email_id) where resend_email_id is not null;
create index if not exists idx_offer_recipients_resend_email
  on public.offer_recipients (resend_email_id) where resend_email_id is not null;

-- ===========================================================================
-- 8. One id, one register (database-11)
-- ===========================================================================
-- As in 0056, except that an insert can no longer move an id that already
-- belongs to the other register: it used to set piece_ref.ledger to the new
-- table while the row stayed in the old one, so the work had two records and
-- the register move that would mend it was refused. A register move sets
-- jvb.ledger_move before its insert and still changes the ledger as before.
-- Unique violation, so PostgREST answers 409.
create or replace function public.ensure_piece_ref()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _ledger public.piece_ledger := tg_argv[0]::public.piece_ledger;
  _held   public.piece_ledger;
begin
  new.id := coalesce(new.id, gen_random_uuid());
  insert into public.piece_ref (id, ledger)
  values (new.id, _ledger)
  on conflict (id) do nothing;

  select r.ledger into _held from public.piece_ref r where r.id = new.id;
  if _held is distinct from _ledger then
    if coalesce(current_setting('jvb.ledger_move', true), '0') = '1' then
      update public.piece_ref set ledger = _ledger where id = new.id;
    else
      raise exception 'Record % is already in the % register', new.id, _held
        using errcode = 'unique_violation',
              hint = 'Move it between registers instead.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.ensure_piece_ref() from public, anon, authenticated;

-- ===========================================================================
-- 9. vw_pieces_all with every stock column (database-12)
-- ===========================================================================
-- `select p.*` is expanded when a view is created, so the view kept 0068's
-- column list and lacks presentation (0085). Recreated as in 0068: drop
-- rather than replace, because the new column lands before the alias
-- columns. Nothing depends on it. Harness test 919 checks that every column
-- of pieces is a column of this view.
drop view if exists public.vw_pieces_all;
create view public.vw_pieces_all
with (security_invoker = true) as
select p.*,
       m.display_name as maker_name,
       m.life_dates   as maker_life_dates,
       c.name         as category_name,
       l.code         as location_code
  from (select * from public.pieces
        union all
        select * from public.external_pieces) p
  left join public.makers     m on m.id = p.maker_id
  left join public.categories c on c.id = p.category_id
  left join public.locations  l on l.id = p.location_id;

comment on view public.vw_pieces_all is
  'Full record for a work in either register. Read-only; writes go through the '
  'stock table that holds the row. Rebuild it whenever a column is added to the '
  'stock tables (select p.* is fixed when the view is created).';

revoke all on public.vw_pieces_all from public, anon;
grant select on public.vw_pieces_all to authenticated, service_role;

-- ===========================================================================
-- 10. Files of deleted rows leave storage, late (database-9,
--     studio-pages-inventory-8, studio-pages-ops-6)
-- ===========================================================================
-- Deleting a photograph, a document, a shipment (its papers cascade), a
-- maker, or purging a work (images and documents cascade) removed the rows
-- that are the only record of the object keys, and nothing removed the
-- files. Now every such delete, and every replaced path, queues the old key
-- here. /api/cron/storage-sweep removes a queued file once it has waited
-- longer than the database backups are kept (30 daily dumps; the cron waits
-- 90 days, never fewer than 35), so restoring a dump never points at a
-- missing file; the weekly storage replica is a plain sync and passes a
-- removal on within a week. A key that a row points at again by then (a
-- restore, a moved image) is forgotten instead of removed. The cron checks
-- each key's shape before it calls the Storage API (never a delete from
-- storage.objects, which would leave the bytes behind).
--
-- Also queued: the display master a deleted photograph would have had (the
-- image worker can upload it after the row has gone), and every expired or
-- used upload slip (an upload begun and never recorded). Removing a file
-- that does not exist is a no-op. Files orphaned before this migration are
-- found in storage.objects and queued once, at the end of this section
-- (queue_storage_orphans), and again by each daily sweep.
--
-- Only object keys (ids), no personal data. Service role only.
create table if not exists public.storage_removals (
  bucket    text not null
            check (bucket in ('piece-originals', 'piece-derivatives', 'piece-documents', 'maker-portraits')),
  path      text not null,
  queued_at timestamptz not null default now(),
  primary key (bucket, path)
);
create index if not exists idx_storage_removals_queued on public.storage_removals (queued_at);

comment on table public.storage_removals is
  'Storage objects whose row was deleted or whose path was replaced, waiting to be removed by '
  '/api/cron/storage-sweep once the database backups have rotated past them. Service role only.';

alter table public.storage_removals enable row level security;
revoke all on public.storage_removals from public, anon, authenticated;
grant select, delete on public.storage_removals to service_role;

-- Queue one key; a key queued again starts its wait again.
create or replace function public.queue_storage_removal(_bucket text, _path text)
returns void
language sql
set search_path = public
as $$
  insert into public.storage_removals (bucket, path)
  select _bucket, _path
   where nullif(btrim(coalesce(_path, '')), '') is not null
  on conflict (bucket, path) do update set queued_at = now();
$$;
revoke execute on function public.queue_storage_removal(text, text) from public, anon, authenticated;

-- One trigger function for every table that holds object keys. SECURITY
-- DEFINER: the deletes run as the signed-in user, who has no grant on the
-- queue.
create or replace function public.queue_storage_removals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'piece_images' then
    if tg_op = 'DELETE' then
      perform public.queue_storage_removal('piece-originals', old.storage_path_original);
      perform public.queue_storage_removal('piece-derivatives',
        coalesce(old.storage_path_display, old.piece_id::text || '/' || old.id::text || '.jpg'));
    else
      if old.storage_path_original is distinct from new.storage_path_original then
        perform public.queue_storage_removal('piece-originals', old.storage_path_original);
      end if;
      if old.storage_path_display is distinct from new.storage_path_display then
        perform public.queue_storage_removal('piece-derivatives', old.storage_path_display);
      end if;
    end if;
  elsif tg_table_name = 'piece_image_squares' then
    if tg_op = 'DELETE' or old.square_path is distinct from new.square_path then
      perform public.queue_storage_removal('piece-derivatives', old.square_path);
    end if;
  elsif tg_table_name in ('piece_documents', 'shipment_documents') then
    if tg_op = 'DELETE' or old.storage_path is distinct from new.storage_path then
      perform public.queue_storage_removal('piece-documents', old.storage_path);
    end if;
  elsif tg_table_name = 'pending_uploads' then
    perform public.queue_storage_removal('piece-documents', old.path);
  elsif tg_table_name = 'makers' then
    if tg_op = 'DELETE' or old.portrait_path is distinct from new.portrait_path then
      perform public.queue_storage_removal('maker-portraits', old.portrait_path);
    end if;
    if tg_op = 'DELETE' or old.portrait_original_path is distinct from new.portrait_original_path then
      perform public.queue_storage_removal('maker-portraits', old.portrait_original_path);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.queue_storage_removals() from public, anon, authenticated;

drop trigger if exists trg_piece_images_storage_removals on public.piece_images;
create trigger trg_piece_images_storage_removals
  after delete or update of storage_path_original, storage_path_display on public.piece_images
  for each row execute function public.queue_storage_removals();

drop trigger if exists trg_piece_image_squares_storage_removals on public.piece_image_squares;
create trigger trg_piece_image_squares_storage_removals
  after delete or update of square_path on public.piece_image_squares
  for each row execute function public.queue_storage_removals();

drop trigger if exists trg_piece_documents_storage_removals on public.piece_documents;
create trigger trg_piece_documents_storage_removals
  after delete or update of storage_path on public.piece_documents
  for each row execute function public.queue_storage_removals();

drop trigger if exists trg_shipment_documents_storage_removals on public.shipment_documents;
create trigger trg_shipment_documents_storage_removals
  after delete or update of storage_path on public.shipment_documents
  for each row execute function public.queue_storage_removals();

drop trigger if exists trg_pending_uploads_storage_removals on public.pending_uploads;
create trigger trg_pending_uploads_storage_removals
  after delete on public.pending_uploads
  for each row execute function public.queue_storage_removals();

drop trigger if exists trg_makers_storage_removals on public.makers;
create trigger trg_makers_storage_removals
  after delete or update of portrait_path, portrait_original_path on public.makers
  for each row execute function public.queue_storage_removals();

-- Every object key a row points at, by bucket: the rows above, and upload
-- slips still open. Internal.
create or replace function public.storage_paths_in_use()
returns table (bucket text, path text)
language sql
stable
set search_path = public
as $$
  select 'piece-originals', i.storage_path_original from public.piece_images i where i.storage_path_original is not null
  union all
  select 'piece-derivatives', i.storage_path_display from public.piece_images i where i.storage_path_display is not null
  union all
  select 'piece-derivatives', s.square_path from public.piece_image_squares s where s.square_path is not null
  union all
  select 'piece-documents', d.storage_path from public.piece_documents d
  union all
  select 'piece-documents', d.storage_path from public.shipment_documents d
  union all
  select 'piece-documents', u.path from public.pending_uploads u
  union all
  select 'maker-portraits', m.portrait_path from public.makers m where m.portrait_path is not null
  union all
  select 'maker-portraits', m.portrait_original_path from public.makers m where m.portrait_original_path is not null;
$$;
revoke execute on function public.storage_paths_in_use() from public, anon, authenticated;

-- What the sweep may remove now: queued longer than _after (never less than
-- 35 days) and pointed at by no row, oldest first. Unless _dry, a queued
-- key that a row points at again is forgotten first.
create or replace function public.storage_removals_due(
  _after interval default '90 days',
  _limit integer default 200,
  _dry   boolean default false)
returns table (bucket text, path text, queued_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(_dry, false) then
    delete from public.storage_removals r
     using public.storage_paths_in_use() u
     where u.bucket = r.bucket and u.path = r.path;
  end if;

  return query
    select r.bucket, r.path, r.queued_at
      from public.storage_removals r
     where r.queued_at < now() - greatest(coalesce(_after, interval '90 days'), interval '35 days')
       and not exists (select 1 from public.storage_paths_in_use() u
                        where u.bucket = r.bucket and u.path = r.path)
     order by r.queued_at, r.bucket, r.path
     limit greatest(1, least(coalesce(_limit, 200), 1000));
end;
$$;
revoke execute on function public.storage_removals_due(interval, integer, boolean) from public, anon, authenticated;
grant execute on function public.storage_removals_due(interval, integer, boolean) to service_role;

-- Drop keys from the queue once removed (or refused by the sweep's shape
-- check). By POST body, so a batch of keys never lands in a URL.
create or replace function public.storage_removals_forget(_bucket text, _paths text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _n integer;
begin
  delete from public.storage_removals r
   where r.bucket = _bucket and r.path = any (coalesce(_paths, '{}'));
  get diagnostics _n = row_count;
  return _n;
end;
$$;
revoke execute on function public.storage_removals_forget(text, text[]) from public, anon, authenticated;
grant execute on function public.storage_removals_forget(text, text[]) to service_role;

-- Files that were orphaned before this migration, which the triggers above
-- never saw: every photograph deleted and every work purged so far left its
-- original, display master, squares and documents behind. Queued here like
-- any other key: every object in the four buckets that no row points at and
-- that has not been written for a day (an upload lands before the row that
-- records it). Each then waits the full backup window from the day it is
-- found and passes the sweep's shape check before anything is removed; a
-- key already queued keeps its place in the queue. Reads storage.objects
-- only; removal still goes through the Storage API.
--
-- Run once below. The daily sweep calls it again (service role), so a file
-- a race leaves behind is caught as well: a square rendered while its
-- photograph was being deleted, an upload whose row was never written.
-- _dry counts what it would queue and queues nothing.
create or replace function public.queue_storage_orphans(
  _grace interval default '1 day',
  _dry   boolean default false)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _cutoff timestamptz := now() - greatest(coalesce(_grace, interval '1 day'), interval '1 day');
  _n      integer;
begin
  if to_regclass('storage.objects') is null then
    return 0;
  end if;

  if coalesce(_dry, false) then
    with used as materialized (select u.bucket, u.path from public.storage_paths_in_use() u)
    select count(*) into _n
      from storage.objects o
     where o.bucket_id in ('piece-originals', 'piece-derivatives', 'piece-documents', 'maker-portraits')
       and nullif(o.name, '') is not null
       and greatest(o.created_at, o.updated_at) < _cutoff
       and not exists (select 1 from used u where u.bucket = o.bucket_id and u.path = o.name)
       and not exists (select 1 from public.storage_removals r
                        where r.bucket = o.bucket_id and r.path = o.name);
  else
    with used as materialized (select u.bucket, u.path from public.storage_paths_in_use() u)
    insert into public.storage_removals (bucket, path)
    select o.bucket_id, o.name
      from storage.objects o
     where o.bucket_id in ('piece-originals', 'piece-derivatives', 'piece-documents', 'maker-portraits')
       and nullif(o.name, '') is not null
       and greatest(o.created_at, o.updated_at) < _cutoff
       and not exists (select 1 from used u where u.bucket = o.bucket_id and u.path = o.name)
    on conflict (bucket, path) do nothing;
    get diagnostics _n = row_count;
  end if;

  return _n;
end;
$$;
revoke execute on function public.queue_storage_orphans(interval, boolean) from public, anon, authenticated;
grant execute on function public.queue_storage_orphans(interval, boolean) to service_role;

select public.queue_storage_orphans();

notify pgrst, 'reload schema';
