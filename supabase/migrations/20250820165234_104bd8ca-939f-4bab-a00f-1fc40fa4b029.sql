-- SECURITY DEFINER REMEDIATION - Convert risky functions to SECURITY INVOKER
-- Only keep SECURITY DEFINER where absolutely necessary for proper functionality

-- =============================================================================
-- 1. CONVERT PUBLIC DATA FUNCTIONS TO SECURITY INVOKER
-- =============================================================================

-- These functions return public data and should use caller's permissions
CREATE OR REPLACE FUNCTION public.get_artists_public()
RETURNS TABLE(
    id uuid, 
    full_name text, 
    biography text, 
    nationality text, 
    birth_year integer, 
    death_year integer, 
    place_of_birth text, 
    place_of_death text, 
    image_url text, 
    representation_status text, 
    surname_first_letter text, 
    created_at timestamp with time zone, 
    updated_at timestamp with time zone
)
LANGUAGE sql
STABLE 
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT 
        a.id,
        a.full_name,
        a.biography,
        a.nationality,
        a.birth_year,
        a.death_year,
        a.place_of_birth,
        a.place_of_death,
        a.image_url,
        a.representation_status,
        a.surname_first_letter,
        a.created_at,
        a.updated_at
    FROM public.artists a;
$$;

-- Convert currency function to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.get_available_currencies()
RETURNS text[]
LANGUAGE sql
STABLE 
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ARRAY(
    SELECT DISTINCT currency 
    FROM public.artworks 
    WHERE currency IS NOT NULL 
    ORDER BY currency
  );
$$;

-- =============================================================================
-- 2. KEEP SECURITY DEFINER ONLY FOR FUNCTIONS THAT NEED ELEVATED PRIVILEGES
-- =============================================================================

-- Functions that check permissions need SECURITY DEFINER to access auth data
-- But add explicit search path for security

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER  -- Keep SECURITY DEFINER - needs to access user_roles
SET search_path TO 'public'  -- Explicit search path
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER  -- Keep SECURITY DEFINER - needs to access user_roles
SET search_path TO 'public'  -- Explicit search path
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = 'gallery_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER  -- Keep SECURITY DEFINER - needs to access user_roles
SET search_path TO 'public'  -- Explicit search path
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'gallery_admin'
  );
END;
$$;

-- =============================================================================
-- 3. CONVERT SIMPLE VALIDATION FUNCTIONS TO SECURITY INVOKER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_artist_owner(artist_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE 
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.artists 
    WHERE id = artist_id_param AND user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_artist_user(_user_id uuid, _artist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.artists
    WHERE id = _artist_id
    AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_artwork_owned_by_current_user(_artwork_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.artworks aw
    JOIN public.artists art ON aw.artist_id = art.id
    WHERE aw.id = _artwork_id AND art.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_collection_accessible_by_current_artist(_collection_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collection_artworks ca
    JOIN public.artworks aw ON ca.artwork_id = aw.id
    JOIN public.artists art ON aw.artist_id = art.id
    WHERE ca.collection_id = _collection_id AND art.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_artist_id_for_current_user()
RETURNS uuid
LANGUAGE sql
STABLE 
SECURITY INVOKER  -- Changed from SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.artists WHERE user_id = auth.uid() LIMIT 1;
$$;

-- =============================================================================
-- 4. LOG SECURITY FUNCTION UPDATES
-- =============================================================================

SELECT public.enhanced_log_security_event(
    'security_definer_functions_remediated',
    'high',
    NULL,
    NULL,
    jsonb_build_object(
        'action', 'converted_risky_security_definer_functions',
        'functions_converted_to_invoker', jsonb_build_array(
            'get_artists_public',
            'get_available_currencies',
            'is_artist_owner',
            'is_artist_user', 
            'is_artwork_owned_by_current_user',
            'is_collection_accessible_by_current_artist',
            'get_artist_id_for_current_user'
        ),
        'functions_kept_as_definer', jsonb_build_array(
            'has_role',
            'is_admin',
            'is_user_admin'
        ),
        'security_improvement', 'reduced_privilege_escalation_risk',
        'status', 'security_definer_functions_secured'
    )
);