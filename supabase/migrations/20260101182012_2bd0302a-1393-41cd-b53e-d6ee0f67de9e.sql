-- Add page dimension fields for flipbook formatting
ALTER TABLE public.publications 
ADD COLUMN page_width INTEGER,
ADD COLUMN page_height INTEGER;

-- Add comments for clarity
COMMENT ON COLUMN public.publications.page_width IS 'Page width in pixels for flipbook rendering';
COMMENT ON COLUMN public.publications.page_height IS 'Page height in pixels for flipbook rendering';