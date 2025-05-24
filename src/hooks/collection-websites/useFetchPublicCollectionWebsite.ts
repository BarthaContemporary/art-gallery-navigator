
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsite } from "@/types/collection-website";

// Fetch a single public collection website by slug
export function useFetchPublicCollectionWebsite(slug: string | undefined) {
  return useQuery<CollectionWebsite | null, Error>({
    queryKey: ["publicCollectionWebsite", slug],
    queryFn: async (): Promise<CollectionWebsite | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("collection_websites")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true) // Only fetch active websites
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116: "Searched item was not found" - not an error for .single() if item might not exist
        throw error;
      }
      return data;
    },
    enabled: !!slug,
  });
}

