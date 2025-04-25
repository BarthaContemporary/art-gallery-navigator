
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Document } from "./use-documents";

export function useCollectionDocuments(collectionId: string) {
  return useQuery({
    queryKey: ["collection-documents", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("collection_id", collectionId)
        .order("date_uploaded", { ascending: false });

      if (error) throw error;
      return data as Document[];
    },
    enabled: !!collectionId
  });
}
