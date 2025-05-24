
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsiteWithCollectionName } from "@/types/collection-website";

// Fetch all collection websites with their associated collection name
export function useFetchAllCollectionWebsites() {
  return useQuery<CollectionWebsiteWithCollectionName[], Error>({
    queryKey: ["allCollectionWebsites"],
    queryFn: async (): Promise<CollectionWebsiteWithCollectionName[]> => {
      const { data, error } = await supabase
        .from("collection_websites")
        .select(`
          *,
          collections (
            id,
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Supabase types might make collections an array, but it should be an object due to the one-to-one relationship here.
      // We'll cast it for now, or adjust based on actual Supabase client behavior.
      // If `collections` can be null (e.g. if a collection was deleted but website orphanend), handle that.
      return (data || []).map(cw => ({
        ...cw,
        // Ensure collections is treated as an object or null, not an array
        collection: Array.isArray(cw.collections) ? cw.collections[0] || null : cw.collections,
      })) as CollectionWebsiteWithCollectionName[];
    },
  });
}
