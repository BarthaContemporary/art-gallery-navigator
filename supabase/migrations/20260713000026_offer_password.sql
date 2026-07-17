-- Optional simple access password for an offer's private pages.
-- When set, the tokenized /o/<token> page asks for this password before
-- revealing the works. The gallery emails the password to the client in the
-- invitation, and the client can also request a short-lived magic sign-in link.
-- Stored in clear because the gallery needs to send it to the client verbatim;
-- it is a low-stakes viewing gate, never an account credential, and is only
-- ever compared server-side (never sent to the browser).
alter table public.offers
  add column if not exists access_password text;

notify pgrst, 'reload schema';
