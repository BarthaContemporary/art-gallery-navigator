-- ---------------------------------------------------------------------------
-- 0075 — every maker gets an artist page unless switched off.
--
-- The artist page used to be opt-in (flag, or a work on the site). The dealer
-- wants the whole makers list on the website, with its biography and profile
-- text, whether or not a work of theirs is currently published. The flag now
-- means "shown" and defaults to on; untick it in the studio to hide a maker.
-- Updating the rows queues every maker for the sync (trg_makers_sync_outbox).
-- ---------------------------------------------------------------------------

alter table public.makers alter column web_visible set default true;
update public.makers set web_visible = true where not web_visible;

notify pgrst, 'reload schema';
