
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsite } from "@/types/collection-website";

// Fetch a single public collection website by slug using the public-safe view
export function useFetchPublicCollectionWebsite(slug: string | undefined) {
  return useQuery<CollectionWebsite | null, Error>({
    queryKey: ["publicCollectionWebsite", slug],
    queryFn: async (): Promise<CollectionWebsite | null> => {
      if (!slug) return null;
      
      // Use the public-safe view that excludes password_hash
      const { data, error } = await supabase
        .from("collection_websites_public_safe")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data as CollectionWebsite | null;
    },
    enabled: !!slug,
  });
}

