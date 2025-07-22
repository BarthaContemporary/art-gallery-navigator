
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function useDeleteArtworkDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, artworkId }: { documentId: string; artworkId: string }) => {
      // Remove the link by setting artwork_id to null
      const { error } = await supabase
        .from("documents")
        .update({ artwork_id: null })
        .eq("id", documentId)
        .eq("artwork_id", artworkId);

      if (error) {
        throw error;
      }

      return { documentId, artworkId };
    },
    onSuccess: ({ artworkId }) => {
      queryClient.invalidateQueries({ queryKey: ["artwork-documents", artworkId] });
      toast.success("Document link removed successfully");
    },
    onError: (error) => {
      console.error("Error removing document link:", error);
      toast.error("Failed to remove document link");
    },
  });
}
