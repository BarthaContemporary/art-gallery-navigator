-- Fix bulk_merge_duplicate_contacts function with proper type handling
CREATE OR REPLACE FUNCTION public.bulk_merge_duplicate_contacts()
 RETURNS TABLE(groups_processed integer, contacts_deleted integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dup_group RECORD;
  master_contact RECORD;
  merged_tags text[];
  merged_artists text[];
  groups_count integer := 0;
  deleted_count integer := 0;
  duplicate_ids uuid[];
  master_id uuid;
BEGIN
  -- Only admins can access this
  IF NOT has_role(auth.uid(), 'gallery_admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: Gallery admin role required';
  END IF;

  -- Process each duplicate group
  FOR dup_group IN 
    SELECT 
      c.email,
      array_agg(c.id ORDER BY c.created_at)::uuid[] as contact_ids
    FROM crm_contacts c
    WHERE c.email IS NOT NULL AND c.email != ''
    GROUP BY c.email
    HAVING COUNT(*) > 1
  LOOP
    -- Get the master contact id (oldest)
    master_id := dup_group.contact_ids[1];
    
    -- Get duplicate IDs (all except first) - explicitly cast to uuid[]
    duplicate_ids := (dup_group.contact_ids)[2:array_length(dup_group.contact_ids, 1)];
    
    -- Skip if no duplicates
    IF duplicate_ids IS NULL OR array_length(duplicate_ids, 1) IS NULL THEN
      CONTINUE;
    END IF;
    
    -- Get the master contact record
    SELECT * INTO master_contact 
    FROM crm_contacts 
    WHERE id = master_id;
    
    -- Merge tags from all duplicates
    SELECT COALESCE(array_agg(DISTINCT tag), ARRAY[]::text[])
    INTO merged_tags
    FROM (
      SELECT unnest(tags) as tag
      FROM crm_contacts
      WHERE id = master_id OR id = ANY(duplicate_ids)
      AND tags IS NOT NULL
    ) t;
    
    -- Merge interested artists from all duplicates
    SELECT COALESCE(array_agg(DISTINCT artist), ARRAY[]::text[])
    INTO merged_artists
    FROM (
      SELECT unnest(interested_artists) as artist
      FROM crm_contacts
      WHERE id = master_id OR id = ANY(duplicate_ids)
      AND interested_artists IS NOT NULL
    ) a;
    
    -- Update master with merged data and fill empty fields from duplicates
    UPDATE crm_contacts SET
      tags = CASE WHEN array_length(merged_tags, 1) > 0 THEN merged_tags ELSE tags END,
      interested_artists = CASE WHEN array_length(merged_artists, 1) > 0 THEN merged_artists ELSE interested_artists END,
      phone = COALESCE(phone, (SELECT phone FROM crm_contacts WHERE id = ANY(duplicate_ids) AND phone IS NOT NULL LIMIT 1)),
      secondary_phone = COALESCE(secondary_phone, (SELECT secondary_phone FROM crm_contacts WHERE id = ANY(duplicate_ids) AND secondary_phone IS NOT NULL LIMIT 1)),
      secondary_email = COALESCE(secondary_email, (SELECT secondary_email FROM crm_contacts WHERE id = ANY(duplicate_ids) AND secondary_email IS NOT NULL LIMIT 1)),
      address_line1 = COALESCE(address_line1, (SELECT address_line1 FROM crm_contacts WHERE id = ANY(duplicate_ids) AND address_line1 IS NOT NULL LIMIT 1)),
      city = COALESCE(city, (SELECT city FROM crm_contacts WHERE id = ANY(duplicate_ids) AND city IS NOT NULL LIMIT 1)),
      country = COALESCE(country, (SELECT country FROM crm_contacts WHERE id = ANY(duplicate_ids) AND country IS NOT NULL LIMIT 1)),
      instagram_handle = COALESCE(instagram_handle, (SELECT instagram_handle FROM crm_contacts WHERE id = ANY(duplicate_ids) AND instagram_handle IS NOT NULL LIMIT 1)),
      linkedin_handle = COALESCE(linkedin_handle, (SELECT linkedin_handle FROM crm_contacts WHERE id = ANY(duplicate_ids) AND linkedin_handle IS NOT NULL LIMIT 1)),
      notes = COALESCE(notes, (SELECT notes FROM crm_contacts WHERE id = ANY(duplicate_ids) AND notes IS NOT NULL LIMIT 1)),
      job_title = COALESCE(job_title, (SELECT job_title FROM crm_contacts WHERE id = ANY(duplicate_ids) AND job_title IS NOT NULL LIMIT 1)),
      organization_id = COALESCE(organization_id, (SELECT organization_id FROM crm_contacts WHERE id = ANY(duplicate_ids) AND organization_id IS NOT NULL LIMIT 1)),
      updated_at = NOW()
    WHERE id = master_id;
    
    -- Update list memberships to point to master (avoid duplicates)
    UPDATE crm_list_members 
    SET contact_id = master_id
    WHERE contact_id = ANY(duplicate_ids)
    AND NOT EXISTS (
      SELECT 1 FROM crm_list_members m2 
      WHERE m2.contact_id = master_id 
      AND m2.list_id = crm_list_members.list_id
    );
    
    -- Delete duplicate list memberships (already exist for master)
    DELETE FROM crm_list_members WHERE contact_id = ANY(duplicate_ids);
    
    -- Update interactions to point to master
    UPDATE crm_interactions SET contact_id = master_id WHERE contact_id = ANY(duplicate_ids);
    
    -- Update deals to point to master
    UPDATE crm_deals SET contact_id = master_id WHERE contact_id = ANY(duplicate_ids);
    
    -- Delete the duplicate contacts
    DELETE FROM crm_contacts WHERE id = ANY(duplicate_ids);
    
    groups_count := groups_count + 1;
    deleted_count := deleted_count + array_length(duplicate_ids, 1);
  END LOOP;
  
  RETURN QUERY SELECT groups_count, deleted_count;
END;
$function$;