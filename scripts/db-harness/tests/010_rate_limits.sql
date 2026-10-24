-- 0089: the shared rate limiter is service-role only and counts per key.
\ir ../lib/helpers.sql
begin;
select t.make_user('staff@example.com', 'staff') as staff_id \gset

-- Within the limit, then over it.
do $$ begin
  if not public.rate_limit_hit('test:k', interval '1 hour', 2) then raise exception 'first hit should pass'; end if;
  if not public.rate_limit_hit('test:k', interval '1 hour', 2) then raise exception 'second hit should pass'; end if;
  if public.rate_limit_hit('test:k', interval '1 hour', 2) then raise exception 'third hit should be refused'; end if;
  if not public.rate_limit_hit('test:other', interval '1 hour', 2) then raise exception 'other key is separate'; end if;
end $$;

-- Neither anon nor a signed-in user may call it or read the hits.
set local role anon;
do $$ begin
  begin
    perform public.rate_limit_hit('x', interval '1 hour', 1);
    raise exception 'anon could call rate_limit_hit';
  exception when insufficient_privilege then null;
  end;
  if t.visible('public.rate_limit_hits') > 0 then raise exception 'anon can read hits'; end if;
end $$;
reset role;
select t.claims(:'staff_id');
set local role authenticated;
do $$ begin
  begin
    perform public.rate_limit_hit('x', interval '1 hour', 1);
    raise exception 'staff could call rate_limit_hit';
  exception when insufficient_privilege then null;
  end;
  if t.visible('public.rate_limit_hits') > 0 then raise exception 'staff can read hits'; end if;
end $$;
reset role;

-- Retention clears old hits.
insert into public.rate_limit_hits (key, at) values ('old', now() - interval '2 days');
select public.apply_retention();
do $$ begin
  if exists (select 1 from public.rate_limit_hits where key = 'old') then raise exception 'retention left an old hit'; end if;
end $$;
rollback;
