-- Function to find duplicate contacts by email
CREATE OR REPLACE FUNCTION public.find_duplicate_contacts()
RETURNS TABLE (
  email text,
  duplicate_count bigint,
  contact_ids uuid[],
  contact_names text[],
  contact_phones text[],
  contact_types text[],
  created_dates timestamptz[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can access this
  IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: Gallery admin role required';
  END IF;

  RETURN QUERY
  SELECT 
    c.email,
    COUNT(*)::bigint as duplicate_count,
    array_agg(c.id ORDER BY c.created_at) as contact_ids,
    array_agg(c.full_name ORDER BY c.created_at) as contact_names,
    array_agg(c.phone ORDER BY c.created_at) as contact_phones,
    array_agg(c.contact_type::text ORDER BY c.created_at) as contact_types,
    array_agg(c.created_at ORDER BY c.created_at) as created_dates
  FROM crm_contacts c
  WHERE c.email IS NOT NULL AND c.email != ''
  GROUP BY c.email
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
END;
$function$;