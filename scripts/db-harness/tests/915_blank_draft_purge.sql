-- 0097 §6 (database-8): purge_blank_draft_pieces deletes only drafts that
-- really are blank. Every draft below is three hours old and has no title;
-- each kept one holds one thing the old test did not look at. A truly blank
-- draft in each register is still purged, and one made 30 minutes ago is not.
\ir ../lib/helpers.sql
begin;

create temporary table drafts (label text primary key, id uuid, tbl text) on commit drop;

-- Truly blank, one per register.
with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'blank jvb', id, 'pieces' from p;
with p as (insert into public.external_pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'blank external', id, 'external_pieces' from p;
-- Blank but recent.
with p as (insert into public.pieces (created_at) values (now() - interval '30 minutes') returning id)
insert into drafts select 'recent', id, 'pieces' from p;

-- One thing typed or attached each.
with p as (insert into public.pieces (created_at, status) values (now() - interval '3 hours', 'reserved') returning id)
insert into drafts select 'status', id, 'pieces' from p;
with p as (insert into public.pieces (created_at, framed, unframed_height_cm) values (now() - interval '3 hours', true, 42) returning id)
insert into drafts select 'framed', id, 'pieces' from p;
with p as (insert into public.pieces (created_at, presentation) values (now() - interval '3 hours', 'object') returning id)
insert into drafts select 'presentation', id, 'pieces' from p;
with p as (insert into public.external_pieces (created_at, photographer) values (now() - interval '3 hours', 'K. Sato') returning id)
insert into drafts select 'photographer (external)', id, 'external_pieces' from p;
with p as (insert into public.pieces (created_at, attribution_qualifier) values (now() - interval '3 hours', 'attributed to') returning id)
insert into drafts select 'attribution', id, 'pieces' from p;
insert into public.crm_contacts (first_name) values ('Co-owner') returning id as consignee_id \gset
with p as (insert into public.pieces (created_at, consignee_contact_id) values (now() - interval '3 hours', :'consignee_id') returning id)
insert into drafts select 'consignee', id, 'pieces' from p;

with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'restoration cost', id, 'pieces' from p;
update public.piece_financials set restoration_cost_gbp = 250 where piece_id = (select id from drafts where label = 'restoration cost');
with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'other costs', id, 'pieces' from p;
update public.piece_financials set other_costs_gbp = 80 where piece_id = (select id from drafts where label = 'other costs');
-- Cost £ typed for a purchase in another currency, before the amount.
with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'purchase gbp', id, 'pieces' from p;
update public.piece_financials set purchase_cost_gbp = 5000, purchase_currency = 'EUR'
 where piece_id = (select id from drafts where label = 'purchase gbp');
with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'vat treatment', id, 'pieces' from p;
update public.piece_financials set vat_treatment = 'standard' where piece_id = (select id from drafts where label = 'vat treatment');
with p as (insert into public.external_pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'sold gbp (external)', id, 'external_pieces' from p;
update public.piece_financials set sold_price_gbp = 900 where piece_id = (select id from drafts where label = 'sold gbp (external)');
with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'import', id, 'pieces' from p;
update public.piece_financials set import_type = 'import_vat_paid', import_vat_gbp = 120
 where piece_id = (select id from drafts where label = 'import');

with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'provenance', id, 'pieces' from p;
insert into public.provenance_entries (piece_id, party) select id, 'Private collection, Kyoto' from drafts where label = 'provenance';
with p as (insert into public.pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'on a list', id, 'pieces' from p;
insert into public.piece_lists (name) values ('TEFAF shortlist') returning id as list_id \gset
insert into public.piece_list_items (list_id, piece_id) select :'list_id', id from drafts where label = 'on a list';
with p as (insert into public.external_pieces (created_at) values (now() - interval '3 hours') returning id)
insert into drafts select 'on an offer (external)', id, 'external_pieces' from p;
insert into public.offers (title) values ('For Mr K') returning id as offer_id \gset
insert into public.offer_items (offer_id, piece_id) select :'offer_id', id from drafts where label = 'on an offer (external)';

select public.purge_blank_draft_pieces('2 hours') as purged \gset
select set_config('t.purged', :'purged', true);

do $$
declare
  _left text[];
  _kept text[];
begin
  select array_agg(d.label order by d.label) into _left
    from drafts d
   where exists (select 1 from public.pieces p where p.id = d.id)
      or exists (select 1 from public.external_pieces e where e.id = d.id);
  if 'blank jvb' = any (_left) or 'blank external' = any (_left) then
    raise exception 'a truly blank draft was not purged';
  end if;
  select array_agg(label order by label) into _kept from drafts where label not in ('blank jvb', 'blank external');
  if _left is distinct from _kept then
    raise exception 'drafts holding data were purged: kept % of %', _left, _kept;
  end if;
  if current_setting('t.purged')::int <> 2 then
    raise exception 'purge_blank_draft_pieces should report 2, got %', current_setting('t.purged');
  end if;
  if exists (select 1 from public.piece_ref r join drafts d on d.id = r.id where d.label like 'blank%') then
    raise exception 'a purged draft left its identity behind';
  end if;
end $$;

-- Still the cron's alone.
do $$ begin
  if has_function_privilege('authenticated', 'public.purge_blank_draft_pieces(interval)', 'execute')
     or not has_function_privilege('service_role', 'public.purge_blank_draft_pieces(interval)', 'execute') then
    raise exception 'purge_blank_draft_pieces grants changed';
  end if;
end $$;
rollback;
