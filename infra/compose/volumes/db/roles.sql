-- Runs once on first boot of the db container (docker-entrypoint-initdb.d).
-- Aligns the passwords of the internal Supabase roles with POSTGRES_PASSWORD
-- so the service DSNs in docker-compose.yml work. (Upstream supabase/docker
-- pattern.)
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER pgbouncer WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_functions_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
