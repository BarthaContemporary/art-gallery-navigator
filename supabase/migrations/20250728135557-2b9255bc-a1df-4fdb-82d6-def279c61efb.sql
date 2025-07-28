-- Phase 1: Critical RLS Policy Fixes (Updated)

-- Fix overly permissive projects table policies - first check what exists
DO $$
BEGIN
  -- Drop existing overly permissive policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Enable all operations for all users') THEN
    DROP POLICY "Enable all operations for all users" ON public.projects;
  END IF;
  
  -- Only create policies if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'projects' AND policyname = 'Admins can manage all projects secure') THEN
    CREATE POLICY "Admins can manage all projects secure" 
    ON public.projects 
    FOR ALL 
    USING (has_role(auth.uid(), 'gallery_admin'::user_role))
    WITH CHECK (has_role(auth.uid(), 'gallery_admin'::user_role));
  END IF;
END $$;

-- Fix project_users table policies
DO $$
BEGIN
  -- Drop overly permissive policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_users' AND qual = 'true') THEN
    EXECUTE format('DROP POLICY %I ON public.project_users', 
      (SELECT policyname FROM pg_policies WHERE tablename = 'project_users' AND qual = 'true' LIMIT 1));
  END IF;
  
  -- Create secure policy if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'project_users' AND policyname = 'Secure project assignments') THEN
    CREATE POLICY "Secure project assignments" 
    ON public.project_users 
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