-- Fix publication_pages RLS policies for better security
-- The issue: authenticated users have unrestricted access to ALL pages

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage pages" ON public.publication_pages;

-- Create more granular policies for authenticated users

-- 1. Authenticated users can read pages of visible publications (same as anon but for authenticated)
CREATE POLICY "Authenticated can read visible publication pages"
ON public.publication_pages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM publications p
    WHERE p.id = publication_pages.publication_id
    AND (
      p.visibility IN ('public', 'unlisted')
      OR p.created_by = auth.uid()
    )
  )
);

-- 2. Only creators can insert pages for their publications
CREATE POLICY "Creators can insert pages"
ON public.publication_pages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM publications p
    WHERE p.id = publication_pages.publication_id
    AND p.created_by = auth.uid()
  )
);

-- 3. Only creators can update their publication pages
CREATE POLICY "Creators can update pages"
ON public.publication_pages
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM publications p
    WHERE p.id = publication_pages.publication_id
    AND p.created_by = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM publications p
    WHERE p.id = publication_pages.publication_id
    AND p.created_by = auth.uid()
  )
);

-- 4. Only creators can delete their publication pages
CREATE POLICY "Creators can delete pages"
ON public.publication_pages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM publications p
    WHERE p.id = publication_pages.publication_id
    AND p.created_by = auth.uid()
  )
);