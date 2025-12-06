
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CollectionWebsiteAdmin } from "@/types/collection-website";

// Fetch a single collection website by ID (admin only - includes password_hash)
const fetchCollectionWebsiteById = async (websiteId: string): Promise<CollectionWebsiteAdmin | null> => {
  if (!websiteId) return null;

  const { data, error } = await supabase
    .from("collection_websites")
    .select("*")
    .eq("id", websiteId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn(`No collection website found with ID: ${websiteId}`);
      return null;
    }
    console.error("Error fetching collection website by ID:", error);
    throw error;
  }

  return data as CollectionWebsiteAdmin;
};

export function useFetchCollectionWebsiteById(websiteId: string | undefined) {
  return useQuery<CollectionWebsiteAdmin | null, Error>({
    queryKey: ["collectionWebsiteById", websiteId],
    queryFn: () => fetchCollectionWebsiteById(websiteId!),
    enabled: !!websiteId,
  });
}
