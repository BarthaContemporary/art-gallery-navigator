-- Add an "other" image role so staff can file images that don't fit the
-- standard front/back/side/signature/box/detail/condition/document roles.
alter type public.image_role add value if not exists 'other';
