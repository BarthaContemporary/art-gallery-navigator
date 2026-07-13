-- Runs once on first boot of the db container (docker-entrypoint-initdb.d).
-- Exposes the JWT settings as database GUCs so PostgREST/RLS helpers can
-- read them. (Upstream supabase/docker pattern.)
\set jwt_secret `echo "$JWT_SECRET"`
\set jwt_exp `echo "$JWT_EXP"`

ALTER DATABASE postgres SET "app.settings.jwt_secret" TO :'jwt_secret';
ALTER DATABASE postgres SET "app.settings.jwt_exp" TO :'jwt_exp';
