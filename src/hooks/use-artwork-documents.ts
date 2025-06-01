
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ArtworkDocument {
  id: string;
  file_name: string;
  file_url: string;
  type: string;
  description: string | null;
  date_uploaded: string;
  artwork_id: string | null;
}

export function useArtworkDocuments(artworkId: string) {
  return useQuery({
    queryKey: ["artwork-documents", artworkId],
    queryFn: async (): Promise<ArtworkDocument[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("artwork_id", artworkId)
        .order("date_uploaded", { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    },
    enabled: !!artworkId,
  });
}
