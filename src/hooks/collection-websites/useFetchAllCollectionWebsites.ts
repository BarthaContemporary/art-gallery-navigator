
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsiteWithCollectionName } from "@/types/collection-website";

// Fetch all collection websites with their associated collection name (admin only)
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
      
      return (data || []).map(cw => ({
        ...cw,
        collection: Array.isArray(cw.collections) ? cw.collections[0] || null : cw.collections,
      })) as CollectionWebsiteWithCollectionName[];
    },
  });
}
