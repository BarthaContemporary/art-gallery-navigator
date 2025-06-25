
-- Fix the remaining functions with mutable search_path security vulnerability

-- Fix public.create_artist_folder_if_needed
CREATE OR REPLACE FUNCTION public.create_artist_folder_if_needed()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create folder if artist has a user_id (is linked to a user account)
  IF NEW.user_id IS NOT NULL THEN
    -- Check if folder already exists for this artist
    IF NOT EXISTS (
      SELECT 1 FROM public.folders 
      WHERE artist_id = NEW.id
    ) THEN
      -- Create the artist's folder
      INSERT INTO public.folders (name, artist_id, created_by, assignment_method)
      VALUES (NEW.full_name || '''s Files', NEW.id, NEW.user_id, 'auto_trigger');
    ELSE
      -- Update folder name if artist name changed
      UPDATE public.folders 
      SET name = NEW.full_name || '''s Files',
          updated_at = NOW()
      WHERE artist_id = NEW.id 
        AND name != NEW.full_name || '''s Files';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix public.link_artist_to_user
CREATE OR REPLACE FUNCTION public.link_artist_to_user(artist_name text, user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  found_user_id UUID;
  found_artist_id UUID;
BEGIN
  -- Find user by email
  SELECT au.id INTO found_user_id
  FROM auth.users au
  WHERE au.email = user_email;
  
  IF found_user_id IS NULL THEN
    RAISE NOTICE 'User with email % not found', user_email;
    RETURN FALSE;
  END IF;
  
  -- Find artist by name
  SELECT a.id INTO found_artist_id
  FROM public.artists a
  WHERE a.full_name ILIKE '%' || artist_name || '%'
  LIMIT 1;
  
  IF found_artist_id IS NULL THEN
    RAISE NOTICE 'Artist with name % not found', artist_name;
    RETURN FALSE;
  END IF;
  
  -- Link artist to user
  UPDATE public.artists
  SET user_id = found_user_id,
      updated_at = NOW()
  WHERE id = found_artist_id;
  
  RAISE NOTICE 'Successfully linked artist % to user %', artist_name, user_email;
  RETURN TRUE;
END;
$$;

-- Fix public.validate_webdav_token
CREATE OR REPLACE FUNCTION public.validate_webdav_token(token_text text)
RETURNS TABLE(user_id uuid, token_id uuid, is_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  token_record RECORD;
BEGIN
  -- Hash the provided token and look it up
  SELECT wt.user_id, wt.id, 
         (wt.is_active AND (wt.expires_at IS NULL OR wt.expires_at > NOW())) as is_valid
  INTO token_record
  FROM public.webdav_tokens wt
  WHERE wt.token_hash = encode(digest(token_text, 'sha256'), 'hex');
  
  IF token_record IS NOT NULL THEN
    -- Update last used timestamp
    UPDATE public.webdav_tokens 
    SET last_used_at = NOW()
    WHERE id = token_record.id;
    
    RETURN QUERY SELECT token_record.user_id, token_record.id, token_record.is_valid;
  ELSE
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, false;
  END IF;
END;
$$;
