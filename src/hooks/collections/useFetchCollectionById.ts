
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Collection } from "@/types/collection";

export function useFetchCollectionById(collectionId: string | undefined) {
  return useQuery<Collection | null, Error>({
    queryKey: ["collectionById", collectionId],
    queryFn: async () => {
      if (!collectionId) return null;

      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("id", collectionId)
        .single();

      if (error) {
        // PGRST116: "Searched item was not found"
        if (error.code === 'PGRST116') {
          console.warn(`Collection with ID ${collectionId} not found.`);
          return null;
        }
        throw error;
      }
      return data as Collection;
    },
    enabled: !!collectionId,
  });
}
