-- Fix clients table RLS policy
-- Issue: Duplicate policy with {public} role

-- Drop the problematic policy that uses {public} role
DROP POLICY IF EXISTS "clients_admin_only_secure" ON public.clients;

-- Keep only the properly configured authenticated policy
-- "Admins can manage all client data" already uses {authenticated} and is correct