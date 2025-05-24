
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsite } from "@/types/collection-website";

// Fetch all websites for a specific collection
export function useFetchCollectionWebsites(collectionId: string | undefined) {
  return useQuery<CollectionWebsite[], Error>({
    queryKey: ["collectionWebsites", collectionId],
    queryFn: async (): Promise<CollectionWebsite[]> => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from("collection_websites")
        .select("*")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!collectionId, // Only run query if collectionId is provided
  });
}

