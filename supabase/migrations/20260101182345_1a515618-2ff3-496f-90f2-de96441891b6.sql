-- Drop the restrictive update policy
DROP POLICY IF EXISTS "Creators can update publications" ON public.publications;

-- Create a more permissive update policy for authenticated users (admins)
CREATE POLICY "Authenticated can update publications"
ON public.publications
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Also update the delete policy to be more permissive
DROP POLICY IF EXISTS "Creators can delete publications" ON public.publications;

CREATE POLICY "Authenticated can delete publications"
ON public.publications
FOR DELETE
TO authenticated
USING (true);