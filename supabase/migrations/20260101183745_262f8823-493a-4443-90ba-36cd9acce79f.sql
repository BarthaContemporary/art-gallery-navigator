-- Fix RLS policies for profiles table
-- Drop any existing policies first, then recreate

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow all users to view profiles" ON public.profiles;

-- Create new restrictive policy - users can only view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Also allow gallery_admin role to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'gallery_admin'
  )
);

-- Fix RLS policies for crm_contacts table
-- Drop existing policies first

DROP POLICY IF EXISTS "Only admins can view contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Only admins can insert contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Only admins can update contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Only admins can delete contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Authenticated users can view contact organizations" ON public.crm_contacts;
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Users can view all contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to view contacts" ON public.crm_contacts;

-- Create restrictive policies - only gallery_admin can access crm_contacts
CREATE POLICY "Only admins can view contacts"
ON public.crm_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'gallery_admin'
  )
);

CREATE POLICY "Only admins can insert contacts"
ON public.crm_contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'gallery_admin'
  )
);

CREATE POLICY "Only admins can update contacts"
ON public.crm_contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'gallery_admin'
  )
);

CREATE POLICY "Only admins can delete contacts"
ON public.crm_contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'gallery_admin'
  )
);