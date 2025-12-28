-- Fix profiles table RLS policies
-- Issue: "Users can view their own profile" policy allows anon role

-- Drop the problematic policies that use {public} role for SELECT
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Gallery admins can view all profiles" ON public.profiles;

-- Recreate policies with proper authentication requirements

-- 1. Authenticated users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Gallery admins can view all profiles (authenticated only)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gallery_admin'::user_role));