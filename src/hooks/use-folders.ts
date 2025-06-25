
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Folder {
  id: string;
  name: string;
  parent_folder_id: string | null;
  artist_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  path: string | null;
}

export function useFolders(parentFolderId?: string | null) {
  return useQuery({
    queryKey: ["folders", parentFolderId],
    queryFn: async (): Promise<Folder[]> => {
      console.log("useFolders - Fetching folders for parent:", parentFolderId);
      
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("parent_folder_id", parentFolderId || null)
        .order("name", { ascending: true });

      console.log("useFolders - Query result:", { data, error });

      if (error) {
        console.error("useFolders - Error fetching folders:", error);
        throw error;
      }
      
      return data as Folder[];
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      name, 
      parentFolderId, 
      artistId 
    }: { 
      name: string; 
      parentFolderId?: string | null;
      artistId?: string | null;
    }) => {
      console.log("Creating folder with:", { name, parentFolderId, artistId });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("folders")
        .insert({
          name,
          parent_folder_id: parentFolderId || null,
          artist_id: artistId || null,
          created_by: user.id,
        })
        .select()
        .single();

      console.log("Create folder result:", { data, error });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success(`Folder "${data.name}" created successfully`);
    },
    onError: (error) => {
      console.error("Error creating folder:", error);
      toast.error("Failed to create folder");
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase
        .from("folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting folder:", error);
      toast.error("Failed to delete folder");
    },
  });
}

export function useRenameFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, newName }: { folderId: string; newName: string }) => {
      const { data, error } = await supabase
        .from("folders")
        .update({ name: newName, updated_at: new Date().toISOString() })
        .eq("id", folderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      toast.success(`Folder renamed to "${data.name}"`);
    },
    onError: (error) => {
      console.error("Error renaming folder:", error);
      toast.error("Failed to rename folder");
    },
  });
}
