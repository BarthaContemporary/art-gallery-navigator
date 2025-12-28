-- Fix publications table RLS policies for better security
-- The issue: authenticated users have unrestricted access to ALL publications

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage publications" ON public.publications;

-- Create more granular policies for authenticated users

-- 1. Authenticated users can read visible publications OR their own
CREATE POLICY "Authenticated can read visible or own publications"
ON public.publications
FOR SELECT
TO authenticated
USING (
  visibility IN ('public', 'unlisted')
  OR created_by = auth.uid()
);

-- 2. Only authenticated users can create publications (as themselves)
CREATE POLICY "Authenticated can create publications"
ON public.publications
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- 3. Only creators can update their publications
CREATE POLICY "Creators can update publications"
ON public.publications
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- 4. Only creators can delete their publications
CREATE POLICY "Creators can delete publications"
ON public.publications
FOR DELETE
TO authenticated
USING (created_by = auth.uid());