
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ArtistFolderOverview {
  artist_id: string;
  artist_name: string;
  user_id: string | null;
  user_email: string | null;
  folder_id: string | null;
  folder_name: string | null;
  assignment_method: string | null;
  folder_created_at: string | null;
  status: 'linked_with_folder' | 'linked_no_folder' | 'folder_no_user' | 'no_link_no_folder';
}

export function useArtistFolderOverview() {
  return useQuery({
    queryKey: ['artist-folder-overview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artist_folder_overview')
        .select('*');
      
      if (error) throw error;
      return data as ArtistFolderOverview[];
    },
  });
}

export function useLinkArtistToUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ artistName, userEmail }: { artistName: string; userEmail: string }) => {
      const { data, error } = await supabase.rpc('link_artist_to_user', {
        artist_name: artistName,
        user_email: userEmail
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (success, { artistName, userEmail }) => {
      if (success) {
        toast.success(`Successfully linked ${artistName} to ${userEmail}`);
        queryClient.invalidateQueries({ queryKey: ['artist-folder-overview'] });
        queryClient.invalidateQueries({ queryKey: ['folders'] });
        queryClient.invalidateQueries({ queryKey: ['artists'] });
      } else {
        toast.error('Failed to link artist to user');
      }
    },
    onError: (error) => {
      console.error('Error linking artist to user:', error);
      toast.error('Failed to link artist to user');
    },
  });
}

export function useUnlinkArtistFromUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (artistId: string) => {
      const { data, error } = await supabase
        .from('artists')
        .update({ user_id: null })
        .eq('id', artistId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Unlinked ${data.full_name} from user account`);
      queryClient.invalidateQueries({ queryKey: ['artist-folder-overview'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['artists'] });
    },
    onError: (error) => {
      console.error('Error unlinking artist from user:', error);
      toast.error('Failed to unlink artist from user');
    },
  });
}

export function useTransferFolderToArtist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ folderId, artistId }: { folderId: string; artistId: string }) => {
      const { data, error } = await supabase
        .from('folders')
        .update({ 
          artist_id: artistId,
          assignment_method: 'manual_transfer',
          updated_at: new Date().toISOString()
        })
        .eq('id', folderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Folder transferred successfully');
      queryClient.invalidateQueries({ queryKey: ['artist-folder-overview'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    },
    onError: (error) => {
      console.error('Error transferring folder:', error);
      toast.error('Failed to transfer folder');
    },
  });
}
