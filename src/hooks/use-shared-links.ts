
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SharedLink {
  id: string;
  token: string;
  file_id: string | null;
  folder_id: string | null;
  created_by: string;
  expires_at: string | null;
  password_hash: string | null;
  permissions: 'view' | 'download' | 'edit';
  is_active: boolean;
  download_count: number;
  max_downloads: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSharedLinkParams {
  fileId?: string;
  folderId?: string;
  permissions: 'view' | 'download' | 'edit';
  expiresAt?: string;
  password?: string;
  maxDownloads?: number;
}

export function useSharedLinks() {
  return useQuery({
    queryKey: ["shared-links"],
    queryFn: async (): Promise<SharedLink[]> => {
      const { data, error } = await supabase
        .from("shared_links")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SharedLink[];
    },
  });
}

export function useCreateSharedLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateSharedLinkParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const linkData: any = {
        created_by: user.id,
        permissions: params.permissions,
        expires_at: params.expiresAt || null,
        max_downloads: params.maxDownloads || null,
      };

      if (params.fileId) {
        linkData.file_id = params.fileId;
      } else if (params.folderId) {
        linkData.folder_id = params.folderId;
      } else {
        throw new Error("Either fileId or folderId must be provided");
      }

      // Hash password if provided
      if (params.password) {
        // In a real implementation, you'd want to hash this properly
        linkData.password_hash = btoa(params.password);
      }

      const { data, error } = await supabase
        .from("shared_links")
        .insert(linkData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links"] });
      toast.success("Shared link created successfully");
    },
    onError: (error) => {
      console.error("Error creating shared link:", error);
      toast.error("Failed to create shared link");
    },
  });
}

export function useDeleteSharedLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("shared_links")
        .update({ is_active: false })
        .eq("id", linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-links"] });
      toast.success("Shared link deleted successfully");
    },
    onError: (error) => {
      console.error("Error deleting shared link:", error);
      toast.error("Failed to delete shared link");
    },
  });
}

export function getSharedLinkUrl(token: string) {
  return `${window.location.origin}/shared/${token}`;
}
