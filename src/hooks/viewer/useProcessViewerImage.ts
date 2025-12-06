/**
 * Hook for processing viewer images via edge function
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProcessImageParams {
  image_id: string;
  original_url: string;
  artwork_id: string;
}

interface ProcessResult {
  success: boolean;
  image_id: string;
  urls: {
    small_url: string;
    medium_url: string;
    large_url: string;
  };
  cached: boolean;
}

export function useProcessViewerImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ProcessImageParams): Promise<ProcessResult> => {
      const { data, error } = await supabase.functions.invoke('process-viewer-image', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      // Invalidate artwork query to refresh with new URLs
      queryClient.invalidateQueries({ queryKey: ['viewer-artwork', variables.artwork_id] });
    },
    onError: (error) => {
      console.error('Image processing error:', error);
      // Don't show toast for background processing - silent failure is OK
    },
  });
}

export function useBatchProcessImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (images: ProcessImageParams[]): Promise<ProcessResult[]> => {
      // Process in parallel with a concurrency limit
      const results: ProcessResult[] = [];
      const batchSize = 3;

      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        const batchPromises = batch.map(async (params) => {
          try {
            const { data, error } = await supabase.functions.invoke('process-viewer-image', {
              body: params,
            });
            if (error) throw error;
            return data;
          } catch (err) {
            console.warn(`Failed to process image ${params.image_id}:`, err);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(Boolean));
      }

      return results;
    },
    onSuccess: (_, variables) => {
      if (variables.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['viewer-artwork', variables[0].artwork_id] });
        toast.success(`Processed ${variables.length} images`);
      }
    },
    onError: (error) => {
      console.error('Batch processing error:', error);
      toast.error('Failed to process some images');
    },
  });
}
