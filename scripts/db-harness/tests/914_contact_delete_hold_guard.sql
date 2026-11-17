-- 0097 §5 (database-6): a contact under a legal hold (contact_legal_holds)
-- cannot be hard-deleted, by the service role (the capture app's route) or by
-- a signed-in user; the refusal is a foreign-key violation (PostgREST 409)
-- naming the holds. A contact without one deletes as before, and erasure
-- still pseudonymises a held contact and deletes one without a hold.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset

-- A business card scanned at a fair, who then bought a work and passed due diligence.
insert into public.crm_contacts (first_name, last_name, email, tags)
  values ('Card', 'Buyer', 'card.buyer@example.com', '{capture}') returning id as held_id \gset
insert into public.pieces (title) values ('Sold bowl') returning id as piece_id \gset
update public.piece_financials set buyer_contact_id = :'held_id', sold_date = current_date, sold_price = 1000
 where piece_id = :'piece_id';
insert into public.kyc_profiles (contact_id, status) values (:'held_id', 'verified') returning id as kyc_id \gset
insert into public.kyc_checks (profile_id, check_type) values (:'kyc_id', 'identity');
-- A card that came to nothing.
insert into public.crm_contacts (first_name, email, tags) values ('Card', 'nobody@example.com', '{capture}')
  returning id as free_id \gset
insert into public.crm_contacts (first_name, email) values ('Free', 'free@example.com') returning id as free2_id \gset
select set_config('t.held_id', :'held_id', true), set_config('t.free_id', :'free_id', true),
       set_config('t.free2_id', :'free2_id', true), set_config('t.piece_id', :'piece_id', true);

-- The capture route deletes with the service role.
set local role service_role;
do $$ begin
  begin
    delete from public.crm_contacts where id = current_setting('t.held_id')::uuid;
    raise exception 'a held contact was deleted by the service role';
  exception when foreign_key_violation then
    if sqlerrm not like '%Purchase or sale record%' or sqlerrm not like '%Anti-money-laundering%' then
      raise exception 'the refusal should name the holds, got: %', sqlerrm;
    end if;
  end;
end $$;
reset role;

-- A staff session deleting directly.
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  begin
    delete from public.crm_contacts where id = current_setting('t.held_id')::uuid;
    raise exception 'a held contact was deleted by staff';
  exception when foreign_key_violation then null;
  end;
  delete from public.crm_contacts where id = current_setting('t.free_id')::uuid;
  if exists (select 1 from public.crm_contacts where id = current_setting('t.free_id')::uuid) then
    raise exception 'a contact without a hold could not be deleted';
  end if;
end $$;
reset role;

do $$ begin
  if not exists (select 1 from public.crm_contacts where id = current_setting('t.held_id')::uuid)
     or (select count(*) from public.kyc_profiles where contact_id = current_setting('t.held_id')::uuid) <> 1
     or (select count(*) from public.kyc_checks k join public.kyc_profiles p on p.id = k.profile_id
          where p.contact_id = current_setting('t.held_id')::uuid) <> 1
     or (select buyer_contact_id from public.piece_financials where piece_id = current_setting('t.piece_id')::uuid)
        is distinct from current_setting('t.held_id')::uuid then
    raise exception 'the refused delete still removed the contact, its due diligence or the sale''s buyer';
  end if;
end $$;

-- Erasure is unaffected: pseudonymises the held contact, deletes the free one.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
do $$
declare _r jsonb;
begin
  _r := public.erase_contact(current_setting('t.held_id')::uuid);
  if _r ->> 'mode' <> 'anonymised' then raise exception 'held contact: erase_contact gave %', _r; end if;
  _r := public.erase_contact(current_setting('t.free2_id')::uuid);
  if _r ->> 'mode' <> 'deleted' then raise exception 'free contact: erase_contact gave %', _r; end if;
end $$;
reset role;
do $$ begin
  if (select email from public.crm_contacts where id = current_setting('t.held_id')::uuid) is not null then
    raise exception 'the held contact was not pseudonymised';
  end if;
  if exists (select 1 from public.crm_contacts where id = current_setting('t.free2_id')::uuid) then
    raise exception 'the free contact was not deleted by erasure';
  end if;
  if has_function_privilege('authenticated', 'public.refuse_held_contact_delete()', 'execute') then
    raise exception 'the guard function is executable by signed-in users';
  end if;
end $$;
rollback;
