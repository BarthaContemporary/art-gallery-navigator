
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EnhancedDocument {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  type: string;
  folder_id: string | null;
  artist_id: string | null;
  is_favorite: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export function useEnhancedDocuments(folderId?: string | null) {
  return useQuery({
    queryKey: ["enhanced-documents", folderId],
    queryFn: async () => {
      console.log("Enhanced documents query - folderId:", folderId);
      
      let query = supabase
        .from("documents")
        .select("*")
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      // Fix the UUID null issue by using proper null checking
      if (folderId === null || folderId === undefined) {
        query = query.is("folder_id", null);
      } else {
        query = query.eq("folder_id", folderId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Enhanced documents query error:", error);
        throw error;
      }

      console.log("Enhanced documents query result:", data);
      return data || [];
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ documentId, isFavorite }: { documentId: string; isFavorite: boolean }) => {
      const { error } = await supabase
        .from("documents")
        .update({ is_favorite: isFavorite })
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-documents"] });
      toast.success("Favorite status updated");
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
      const { error } = await supabase
        .from("documents")
        .update({ 
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq("id", documentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enhanced-documents"] });
      toast.success("Document deleted");
    },
    onError: (error) => {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    },
  });
}
