
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsite } from "@/types/collection-website";

const fetchCollectionWebsiteById = async (websiteId: string): Promise<CollectionWebsite | null> => {
  if (!websiteId) return null;

  const { data, error } = await supabase
    .from("collection_websites")
    .select("*")
    .eq("id", websiteId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // PostgREST error code for " esattamente una riga (zero righe restituite)" meaning "exactly one row (zero rows returned)"
      console.warn(`No collection website found with ID: ${websiteId}`);
      return null; // Or throw a specific "Not Found" error
    }
    console.error("Error fetching collection website by ID:", error);
    throw error;
  }

  return data;
};

export function useFetchCollectionWebsiteById(websiteId: string | undefined) {
  return useQuery<CollectionWebsite | null, Error>({
    queryKey: ["collectionWebsiteById", websiteId],
    queryFn: () => fetchCollectionWebsiteById(websiteId!),
    enabled: !!websiteId, // Only run query if websiteId is provided
  });
}
