-- ---------------------------------------------------------------------------
-- 0079 — review helper for PECR reg. 22: emailable contacts whose consent
-- record is only the bulk-import note and who have never transacted with the
-- gallery, so neither consent nor the soft opt-in is evidenced. Admin only.
-- ---------------------------------------------------------------------------
create or replace function public.contacts_with_weak_marketing_basis()
returns table (id uuid, first_name text, last_name text, email text, consent_source text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.first_name, c.last_name, c.email, c.consent_source
  from public.crm_contacts c
  where c.marketing_consent
    and c.email is not null
    and c.unsubscribed_at is null
    and c.erased_at is null
    and (c.consent_source is null or c.consent_source ilike 'pre-existing%' or c.consent_source ilike '%import%')
    and c.consent_evidence is null
    and not exists (select 1 from public.piece_financials f where f.buyer_contact_id = c.id or f.seller_contact_id = c.id)
    and not exists (select 1 from public.consignments k where k.counterparty_contact_id = c.id)
    and not exists (select 1 from public.orders o where o.contact_id = c.id)
  order by c.last_name, c.first_name;
$$;
revoke all on function public.contacts_with_weak_marketing_basis() from public, anon;
grant execute on function public.contacts_with_weak_marketing_basis() to authenticated, service_role;

notify pgrst, 'reload schema';
