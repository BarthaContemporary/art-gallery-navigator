-- Function to automatically link artists to users by matching email
CREATE OR REPLACE FUNCTION public.auto_link_artist_to_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  artist_record RECORD;
  user_id_found UUID;
BEGIN
  -- Loop through all artists with emails but no user_id
  FOR artist_record IN 
    SELECT id, email, full_name 
    FROM public.artists 
    WHERE email IS NOT NULL 
    AND user_id IS NULL
  LOOP
    -- Find matching user by email
    SELECT au.id INTO user_id_found
    FROM auth.users au
    WHERE au.email = artist_record.email;
    
    -- If user found, link them
    IF user_id_found IS NOT NULL THEN
      UPDATE public.artists
      SET user_id = user_id_found,
          updated_at = NOW()
      WHERE id = artist_record.id;
      
      RAISE NOTICE 'Linked artist % (%) to user %', 
        artist_record.full_name, artist_record.email, user_id_found;
    END IF;
  END LOOP;
END;
$$;

-- Function to link artist when email changes
CREATE OR REPLACE FUNCTION public.link_artist_on_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_id_found UUID;
BEGIN
  -- Only process if email actually changed and is not null
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    -- Find user with matching email
    SELECT au.id INTO user_id_found
    FROM auth.users au
    WHERE au.email = NEW.email;
    
    -- If user found, link them
    IF user_id_found IS NOT NULL THEN
      NEW.user_id = user_id_found;
      RAISE NOTICE 'Auto-linked artist % to user % via email %', 
        NEW.full_name, user_id_found, NEW.email;
    ELSE
      -- If no user found and email changed, clear the user_id
      NEW.user_id = NULL;
      RAISE NOTICE 'Cleared user link for artist % - no matching user for email %', 
        NEW.full_name, NEW.email;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to link artist when new user is created
CREATE OR REPLACE FUNCTION public.link_artist_on_user_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  artist_id_found UUID;
BEGIN
  -- Find artist with matching email that doesn't have a user_id
  SELECT a.id INTO artist_id_found
  FROM public.artists a
  WHERE a.email = NEW.email
  AND a.user_id IS NULL
  LIMIT 1;
  
  -- If artist found, link them
  IF artist_id_found IS NOT NULL THEN
    UPDATE public.artists
    SET user_id = NEW.id,
        updated_at = NOW()
    WHERE id = artist_id_found;
    
    RAISE NOTICE 'Auto-linked new user % to existing artist %', 
      NEW.email, artist_id_found;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for artist email changes
DROP TRIGGER IF EXISTS auto_link_artist_email_trigger ON public.artists;
CREATE TRIGGER auto_link_artist_email_trigger
  BEFORE UPDATE ON public.artists
  FOR EACH ROW
  EXECUTE FUNCTION public.link_artist_on_email_change();

-- Create trigger for new user creation
DROP TRIGGER IF EXISTS auto_link_user_creation_trigger ON auth.users;
CREATE TRIGGER auto_link_user_creation_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_artist_on_user_creation();

-- Run initial linking for existing records
SELECT public.auto_link_artist_to_user();