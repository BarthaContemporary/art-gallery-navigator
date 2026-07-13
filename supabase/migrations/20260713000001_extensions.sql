-- 0001_extensions
-- Postgres extensions required by the schema.
--
--   pgcrypto  : gen_random_bytes() for invitation/offer/unsubscribe tokens
--   pg_trgm   : trigram fuzzy search on titles / maker names / stock numbers
--   vector    : pgvector, semantic search embeddings (ships with Supabase)
--   pg_net    : async HTTP from triggers (sync outbox -> Vercel webhook).
--               Not always available locally, so it is allowed to fail.

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;

-- pg_net is present on hosted/self-hosted Supabase but may be missing from a
-- bare local Postgres; skip gracefully so `supabase db reset` never breaks.
do $$
begin
  create extension if not exists pg_net;
exception
  when others then
    raise notice 'pg_net extension not available in this environment, skipping (outbox HTTP push disabled; cron drain still works)';
end;
$$;
