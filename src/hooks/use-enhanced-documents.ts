
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EnhancedDocument {
  id: string;
  file_name: string;
  file_url: string;
  type: string;
  description: string | null;
  artwork_id: string | null;
  collection_id: string | null;
  artist_id: string | null;
  folder_id: string | null;
  file_size: number | null;
  mime_type: string | null;
  is_favorite: boolean;
  is_deleted: boolean;
  deleted_at: string | null;
  version_number: number;
  date_uploaded: string;
  created_at: string;
  updated_at: string;
}

export function useEnhancedDocuments(folderId?: string | null) {
  return useQuery({
    queryKey: ["enhanced-documents", folderId],
    queryFn: async (): Promise<EnhancedDocument[]> => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("folder_id", folderId || null)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EnhancedDocument[];
    },
  });
}

export function useMoveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, folderId }: { documentId: string; folderId: string | null }) => {
      const { data, error } = await supabase
        .from("documents")
        .update({ 
          folder_id: folderId,
          updated_at: new Date().toISOString()
        })
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-documents"] });
      toast.success("Document moved successfully");
    },
    onError: (error) => {
      console.error("Error moving document:", error);
      toast.error("Failed to move document");
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, isFavorite }: { documentId: string; isFavorite: boolean }) => {
      const { data, error } = await supabase
        .from("documents")
        .update({ 
          is_favorite: isFavorite,
          updated_at: new Date().toISOString()
        })
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-documents"] });
      toast.success(data.is_favorite ? "Added to favorites" : "Removed from favorites");
    },
    onError: (error) => {
      console.error("Error toggling favorite:", error);
      toast.error("Failed to update favorite status");
    },
  });
}

export function useSoftDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data, error } = await supabase
        .from("documents")
        .update({ 
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", documentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-documents"] });
      toast.success("Document moved to trash");
    },
    onError: (error) => {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    },
  });
}
