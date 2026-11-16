-- 0097 §7 (database-10): the Admin page's "newest changes" read and the
-- retention job's delete by age use an index on activity_log.created_at,
-- and the Resend webhook finds a send by its provider email id through an
-- index rather than a scan per delivery event.
\ir ../lib/helpers.sql
begin;
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'activity_log'
                  and indexname = 'idx_activity_log_created') then
    raise exception 'activity_log has no created_at index';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'crm_campaign_recipients'
                  and indexdef ilike '%(resend_email_id)%') then
    raise exception 'crm_campaign_recipients has no resend_email_id index';
  end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'offer_recipients'
                  and indexdef ilike '%(resend_email_id)%') then
    raise exception 'offer_recipients has no resend_email_id index';
  end if;
end $$;

-- The plans, with sequential scans off so the small harness tables cannot
-- hide a missing index.
set local enable_seqscan = off;
do $$
declare
  _plan text := '';
begin
  -- EXPLAIN cannot be selected from; read its lines through EXECUTE.
  for _plan in execute 'explain select id from public.activity_log order by created_at desc limit 15' loop
    exit when _plan ilike '%idx_activity_log_created%';
  end loop;
  if _plan not ilike '%idx_activity_log_created%' then
    raise exception 'the newest-changes read does not use the created_at index';
  end if;
  for _plan in execute 'explain select id from public.offer_recipients where resend_email_id = ''re_123''' loop
    exit when _plan ilike '%resend_email%';
  end loop;
  if _plan not ilike '%resend_email%' then
    raise exception 'the webhook lookup does not use the resend_email_id index';
  end if;
end $$;
rollback;
