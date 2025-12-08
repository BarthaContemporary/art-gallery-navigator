-- Drop the overly permissive public access policy
DROP POLICY IF EXISTS "Anyone can view available appointment slots" ON public.appointment_slots;

-- Create a new policy requiring authentication
CREATE POLICY "Authenticated users can view available slots" 
  ON public.appointment_slots 
  FOR SELECT 
  TO authenticated
  USING (is_available = true);