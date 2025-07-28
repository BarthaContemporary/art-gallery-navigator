-- Phase 1: Critical RLS Policy Fixes

-- Fix overly permissive projects table policies
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.projects;
DROP POLICY IF EXISTS "Users can view projects they are assigned to" ON public.projects;
DROP POLICY IF EXISTS "Admins can manage all projects" ON public.projects;

-- Create proper role-based policies for projects
CREATE POLICY "Admins can manage all projects" 
ON public.projects 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Users can view assigned projects" 
ON public.projects 
FOR SELECT 
USING (
  has_role(auth.uid(), 'gallery_admin'::user_role) OR 
  id IN (SELECT project_id FROM public.project_users WHERE user_id = auth.uid())
);

-- Fix project_users table policies
DROP POLICY IF EXISTS "Users can view project assignments" ON public.project_users;
DROP POLICY IF EXISTS "Admins can manage project assignments" ON public.project_users;

CREATE POLICY "Admins can manage project assignments" 
ON public.project_users 
FOR ALL 
USING (has_role(auth.uid(), 'gallery_admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));

CREATE POLICY "Users can view their own assignments" 
ON public.project_users 
FOR SELECT 
USING (user_id = auth.uid() OR has_role(auth.uid(), 'gallery_admin'::user_role));

-- Fix sales table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Enable all operations for all users" ON public.sales;
    
    CREATE POLICY "Admins can manage all sales" 
    ON public.sales 
    FOR ALL 
    USING (has_role(auth.uid(), 'gallery_admin'::user_role))
    WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));
  END IF;
END $$;

-- Phase 4: Role Protection - Prevent role escalation
CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent users from modifying their own roles unless they're admin
  IF NEW.user_id = auth.uid() AND NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Users cannot modify their own roles';
  END IF;
  
  -- Log role changes for audit
  PERFORM public.enhanced_log_security_event(
    'role_modification_attempt',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
      'target_user_id', NEW.user_id,
      'new_role', NEW.role,
      'old_role', CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE NULL END,
      'modified_by', auth.uid(),
      'operation', TG_OP
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for role protection
DROP TRIGGER IF EXISTS prevent_role_escalation_trigger ON public.user_roles;
CREATE TRIGGER prevent_role_escalation_trigger
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_escalation();