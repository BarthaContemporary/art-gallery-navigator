import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ViewerArtwork, ViewerArtworkImage } from '@/types/viewer';
import { toast } from 'sonner';

export function useViewerArtworks() {
  return useQuery({
    queryKey: ['viewer-artworks'],
    queryFn: async (): Promise<ViewerArtwork[]> => {
      const { data, error } = await supabase
        .from('viewer_artworks')
        .select(`
          *,
          images:viewer_artwork_images(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as ViewerArtwork[];
    },
  });
}

export function useViewerArtwork(id: string | undefined) {
  return useQuery({
    queryKey: ['viewer-artwork', id],
    queryFn: async (): Promise<ViewerArtwork | null> => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('viewer_artworks')
        .select(`
          *,
          images:viewer_artwork_images(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      
      // Sort images by position
      if (data?.images) {
        (data as any).images.sort((a: ViewerArtworkImage, b: ViewerArtworkImage) => a.position - b.position);
      }
      
      return data as unknown as ViewerArtwork;
    },
    enabled: !!id,
  });
}

export function useCreateViewerArtwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (artwork: { artist_name: string; title: string; year?: string }) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('viewer_artworks')
        .insert({
          artist_name: artwork.artist_name,
          title: artwork.title,
          year: artwork.year || null,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewer-artworks'] });
      toast.success('Artwork created');
    },
    onError: (error) => {
      toast.error('Failed to create artwork');
      console.error(error);
    },
  });
}

export function useUpdateViewerArtwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ViewerArtwork> & { id: string }) => {
      const { data, error } = await supabase
        .from('viewer_artworks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['viewer-artworks'] });
      queryClient.invalidateQueries({ queryKey: ['viewer-artwork', variables.id] });
      toast.success('Artwork updated');
    },
    onError: (error) => {
      toast.error('Failed to update artwork');
      console.error(error);
    },
  });
}

export function useDeleteViewerArtwork() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('viewer_artworks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewer-artworks'] });
      toast.success('Artwork deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete artwork');
      console.error(error);
    },
  });
}
