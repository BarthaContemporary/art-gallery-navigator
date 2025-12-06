
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsiteAdmin } from "@/types/collection-website";

// Fetch all websites for a specific collection (admin only - includes password_hash)
export function useFetchCollectionWebsites(collectionId: string | undefined) {
  return useQuery<CollectionWebsiteAdmin[], Error>({
    queryKey: ["collectionWebsites", collectionId],
    queryFn: async (): Promise<CollectionWebsiteAdmin[]> => {
      if (!collectionId) return [];
      const { data, error } = await supabase
        .from("collection_websites")
        .select("*")
        .eq("collection_id", collectionId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as CollectionWebsiteAdmin[];
    },
    enabled: !!collectionId,
  });
}

