-- Fix search_path for update_page_text_tokens function
CREATE OR REPLACE FUNCTION public.update_page_text_tokens()
RETURNS TRIGGER AS $$
BEGIN
    NEW.text_tokens := to_tsvector('english', COALESCE(NEW.text_content, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix search_path for generate_publication_slug function
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix search_path for search_publication_pages function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;