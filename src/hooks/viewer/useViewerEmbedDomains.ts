import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ViewerEmbedDomain } from '@/types/viewer';
import { toast } from 'sonner';

export function useViewerEmbedDomains() {
  return useQuery({
    queryKey: ['viewer-embed-domains'],
    queryFn: async (): Promise<ViewerEmbedDomain[]> => {
      const { data, error } = await supabase
        .from('viewer_embed_domains')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useAddEmbedDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domain: string) => {
      const { data, error } = await supabase
        .from('viewer_embed_domains')
        .insert({ domain: domain.toLowerCase().trim() })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewer-embed-domains'] });
      toast.success('Domain added');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Domain already exists');
      } else {
        toast.error('Failed to add domain');
      }
      console.error(error);
    },
  });
}

export function useDeleteEmbedDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('viewer_embed_domains')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['viewer-embed-domains'] });
      toast.success('Domain removed');
    },
    onError: (error) => {
      toast.error('Failed to remove domain');
      console.error(error);
    },
  });
}
