import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ViewerArtworkImage } from '@/types/viewer';
import { toast } from 'sonner';

export function useAddViewerImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (image: {
      artwork_id: string;
      original_url: string;
      alt_text?: string;
      width?: number;
      height?: number;
      position?: number;
    }) => {
      const { data, error } = await supabase
        .from('viewer_artwork_images')
        .insert(image)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['viewer-artwork', variables.artwork_id] });
      queryClient.invalidateQueries({ queryKey: ['viewer-artworks'] });
    },
    onError: (error) => {
      toast.error('Failed to add image');
      console.error(error);
    },
  });
}

export function useUpdateViewerImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, artwork_id, ...updates }: Partial<ViewerArtworkImage> & { id: string; artwork_id: string }) => {
      const { data, error } = await supabase
        .from('viewer_artwork_images')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...data, artwork_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['viewer-artwork', data.artwork_id] });
      queryClient.invalidateQueries({ queryKey: ['viewer-artworks'] });
    },
    onError: (error) => {
      toast.error('Failed to update image');
      console.error(error);
    },
  });
}

export function useDeleteViewerImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, artwork_id }: { id: string; artwork_id: string }) => {
      const { error } = await supabase
        .from('viewer_artwork_images')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { artwork_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['viewer-artwork', data.artwork_id] });
      queryClient.invalidateQueries({ queryKey: ['viewer-artworks'] });
      toast.success('Image deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete image');
      console.error(error);
    },
  });
}

export function useReorderViewerImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ artwork_id, images }: { artwork_id: string; images: { id: string; position: number }[] }) => {
      const updates = images.map((img) =>
        supabase
          .from('viewer_artwork_images')
          .update({ position: img.position })
          .eq('id', img.id)
      );

      await Promise.all(updates);
      return { artwork_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['viewer-artwork', data.artwork_id] });
    },
    onError: (error) => {
      toast.error('Failed to reorder images');
      console.error(error);
    },
  });
}
