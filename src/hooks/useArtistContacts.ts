import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface ArtistContact {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
}

/**
 * Hook to fetch artist contact information (email addresses)
 * Only available to gallery admins for security reasons
 */
export function useArtistContacts() {
  const { isAdmin } = useAuth();

  return useQuery({
    queryKey: ['artist-contacts'],
    queryFn: async (): Promise<ArtistContact[]> => {
      if (!isAdmin) {
        throw new Error('Access denied: Admin role required to access artist contact information');
      }

      const { data, error } = await supabase.rpc('get_artist_contacts_admin_only');
      
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });
}