-- 0047_maker_profile
-- Maker profile assets: a representative (portrait) image and a rich-text
-- profile. profile_html holds sanitised HTML from the studio's editor — the
-- source for maker profile PDFs and website pages.

alter table public.makers
  add column if not exists portrait_path text,
  add column if not exists profile_html text;

notify pgrst, 'reload schema';
