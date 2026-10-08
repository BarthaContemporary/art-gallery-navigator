-- ---------------------------------------------------------------------------
-- 0084 — where the face is in a maker's portrait.
--
-- The website shows portraits as squares centred on the face. The studio
-- detects the face when a portrait is processed (and the sync does so for
-- portraits that predate this) and keeps the result here as fractions of
-- the image: {x, y, width, height, method, score, detectedAt}. The sync
-- writes it to Sanity as the portrait hotspot. Not personal data beyond the
-- portrait itself, which the maker record already holds.
-- ---------------------------------------------------------------------------

alter table public.makers add column if not exists portrait_focus jsonb;

comment on column public.makers.portrait_focus is
  'Face position in the portrait as image fractions {x,y,width,height,method,score,detectedAt}; set by the studio, synced to Sanity as the hotspot.';

notify pgrst, 'reload schema';
