-- Fix remaining overly permissive policies

-- 1. in_app_notifications: System insert should be restricted
-- The "System can create notifications" policy allows ANY user to create notifications
-- It should be admin-only or use a security definer function
DROP POLICY IF EXISTS "System can create notifications" ON public.in_app_notifications;

CREATE POLICY "Admins can create notifications"
ON public.in_app_notifications
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

-- 2. project_users: Clean up duplicate and conflicting policies
-- Remove the overly permissive ones, keep the proper ones
DROP POLICY IF EXISTS "project_users_insert_policy" ON public.project_users;
DROP POLICY IF EXISTS "Users can insert project members" ON public.project_users;

-- Users should only be able to add themselves (already exists as "Users can add themselves to projects")
-- Admins can manage all (already covered by multiple admin policies)

-- Note: "Block direct inserts into project_users" with WITH CHECK (false) is intentional
-- It blocks public inserts while authenticated policies still work