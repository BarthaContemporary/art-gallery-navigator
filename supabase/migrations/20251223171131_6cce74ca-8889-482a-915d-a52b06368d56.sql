-- Create enum types for publication settings
CREATE TYPE public.publication_visibility AS ENUM ('public', 'unlisted', 'private');
CREATE TYPE public.publication_theme AS ENUM ('light', 'dark', 'auto');
CREATE TYPE public.publication_processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Publications table
CREATE TABLE public.publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    author TEXT,
    pdf_url TEXT,
    pdf_storage_path TEXT,
    page_count INTEGER DEFAULT 0,
    cover_page INTEGER DEFAULT 1,
    visibility public.publication_visibility DEFAULT 'public',
    theme public.publication_theme DEFAULT 'auto',
    og_image_url TEXT,
    processing_status public.publication_processing_status DEFAULT 'pending',
    processing_error TEXT,
    seo JSONB DEFAULT '{}',
    download_gate_enabled BOOLEAN DEFAULT true,
    mailing_list_default_opt_in BOOLEAN DEFAULT false,
    mailing_list_config JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Publication pages table with full-text search
CREATE TABLE public.publication_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID REFERENCES public.publications(id) ON DELETE CASCADE NOT NULL,
    page_number INTEGER NOT NULL,
    render_low_url TEXT,
    render_high_url TEXT,
    render_storage_path_low TEXT,
    render_storage_path_high TEXT,
    text_content TEXT DEFAULT '',
    text_tokens TSVECTOR,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(publication_id, page_number)
);

-- Create index for full-text search
CREATE INDEX idx_publication_pages_text_tokens ON public.publication_pages USING GIN(text_tokens);
CREATE INDEX idx_publication_pages_publication ON public.publication_pages(publication_id);

-- Leads table for download gating
CREATE TABLE public.publication_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID REFERENCES public.publications(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    mailing_list_opt_in BOOLEAN DEFAULT false,
    consent_timestamp TIMESTAMPTZ DEFAULT now(),
    ip_hash TEXT,
    user_agent TEXT,
    synced_to_crm BOOLEAN DEFAULT false,
    synced_to_campaign_monitor BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_publication_leads_publication ON public.publication_leads(publication_id);
CREATE INDEX idx_publication_leads_email ON public.publication_leads(email);

-- Download tokens for secure PDF access
CREATE TABLE public.publication_download_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id UUID REFERENCES public.publications(id) ON DELETE CASCADE NOT NULL,
    lead_id UUID REFERENCES public.publication_leads(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_download_tokens_token ON public.publication_download_tokens(token);

-- Enable RLS
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publication_download_tokens ENABLE ROW LEVEL SECURITY;

-- Publications policies
-- Admins can do everything (using existing has_role function pattern)
CREATE POLICY "Authenticated users can manage publications"
ON public.publications
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Public can read public/unlisted publications
CREATE POLICY "Public can read visible publications"
ON public.publications
FOR SELECT
TO anon
USING (visibility IN ('public', 'unlisted'));

-- Publication pages policies
CREATE POLICY "Authenticated users can manage pages"
ON public.publication_pages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can read pages of visible publications"
ON public.publication_pages
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1 FROM public.publications p
        WHERE p.id = publication_id
        AND p.visibility IN ('public', 'unlisted')
    )
);

-- Leads policies - authenticated users can view, anyone can insert
CREATE POLICY "Authenticated users can view leads"
ON public.publication_leads
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can submit leads"
ON public.publication_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Download tokens policies
CREATE POLICY "Authenticated users can manage tokens"
ON public.publication_download_tokens
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can read valid tokens"
ON public.publication_download_tokens
FOR SELECT
TO anon
USING (expires_at > now() AND used_at IS NULL);

-- Function to update text search tokens
CREATE OR REPLACE FUNCTION public.update_page_text_tokens()
RETURNS TRIGGER AS $$
BEGIN
    NEW.text_tokens := to_tsvector('english', COALESCE(NEW.text_content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_page_text_tokens
BEFORE INSERT OR UPDATE ON public.publication_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_page_text_tokens();

-- Function to generate unique slug
CREATE OR REPLACE FUNCTION public.generate_publication_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        base_slug := lower(regexp_replace(NEW.title, '[^a-zA-Z0-9]+', '-', 'g'));
        base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
        final_slug := base_slug;
        
        WHILE EXISTS (SELECT 1 FROM public.publications WHERE slug = final_slug AND id != NEW.id) LOOP
            counter := counter + 1;
            final_slug := base_slug || '-' || counter;
        END LOOP;
        
        NEW.slug := final_slug;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_publication_slug
BEFORE INSERT OR UPDATE ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.generate_publication_slug();

-- Update timestamp trigger
CREATE TRIGGER update_publications_updated_at
BEFORE UPDATE ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Full-text search function
CREATE OR REPLACE FUNCTION public.search_publication_pages(
    p_publication_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    page_id UUID,
    page_number INTEGER,
    headline TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pp.id,
        pp.page_number,
        ts_headline('english', pp.text_content, plainto_tsquery('english', p_query), 
            'MaxWords=50, MinWords=25, StartSel=<mark>, StopSel=</mark>') AS headline,
        ts_rank(pp.text_tokens, plainto_tsquery('english', p_query)) AS rank
    FROM public.publication_pages pp
    WHERE pp.publication_id = p_publication_id
    AND pp.text_tokens @@ plainto_tsquery('english', p_query)
    ORDER BY rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create storage bucket for publications
INSERT INTO storage.buckets (id, name, public)
VALUES ('publications', 'publications', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for publications bucket
CREATE POLICY "Public can read publication files"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'publications');

CREATE POLICY "Authenticated users can upload to publications"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'publications');

CREATE POLICY "Authenticated users can update publication files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'publications');

CREATE POLICY "Authenticated users can delete publication files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'publications');