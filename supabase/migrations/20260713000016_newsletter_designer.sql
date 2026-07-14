-- ---------------------------------------------------------------------------
-- Newsletter designer: store the block-based design document + compiled HTML
-- on crm_campaigns so the studio email designer can round-trip a draft and
-- Resend can send the rendered HTML. All additive/idempotent so the bootstrap
-- migrate step can re-apply it safely.
-- ---------------------------------------------------------------------------

alter table public.crm_campaigns
  add column if not exists design       jsonb,          -- block document (designer state)
  add column if not exists body_html    text,           -- compiled, email-safe HTML
  add column if not exists preview_text text,            -- inbox preheader
  add column if not exists from_address text,            -- overrides EMAIL_FROM
  add column if not exists list_id      uuid references public.crm_lists (id) on delete set null,
  add column if not exists test_sent_at timestamptz;

comment on column public.crm_campaigns.design is
  'Block-based newsletter design document produced by the studio email designer.';
comment on column public.crm_campaigns.body_html is
  'Compiled email-safe HTML rendered from design; {{salutation}}/{{unsubscribe_url}} tokens substituted per recipient at send time.';
