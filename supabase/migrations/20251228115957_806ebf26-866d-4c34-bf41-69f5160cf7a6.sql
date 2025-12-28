-- Add AI-generated content columns for SEO and search functionality
ALTER TABLE public.publications 
ADD COLUMN IF NOT EXISTS toc JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS keyword_index JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS full_text_summary TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.publications.toc IS 'AI-generated table of contents with page numbers';
COMMENT ON COLUMN public.publications.keyword_index IS 'AI-generated keyword index for SEO and search';
COMMENT ON COLUMN public.publications.full_text_summary IS 'AI-generated summary of the publication content';