import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getStorageObjectUrl } from '@/lib/supabase-url';

export interface DealAttachment {
  id: string;
  deal_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_by: string;
  created_at: string;
}

export function useDealAttachments(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal-attachments', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('crm_deal_attachments')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as DealAttachment[];
    },
    enabled: !!dealId,
  });
}

export function useUploadDealAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      deal_id, 
      file, 
      onProgress 
    }: { 
      deal_id: string; 
      file: File; 
      onProgress?: (percent: number) => void;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Upload file to storage with progress tracking
      const fileExt = file.name.split('.').pop();
      const fileName = `${deal_id}/${crypto.randomUUID()}.${fileExt}`;
      
      // Use XMLHttpRequest for progress tracking
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      const uploadUrl = getStorageObjectUrl('deal-attachments', fileName);
      
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        });
        
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.send(file);
      });
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('deal-attachments')
        .getPublicUrl(fileName);
      
      // Create attachment record
      const { data, error } = await supabase
        .from('crm_deal_attachments')
        .insert({
          deal_id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-attachments', variables.deal_id] });
    },
  });
}

export function useDeleteDealAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, deal_id, file_url }: { id: string; deal_id: string; file_url: string }) => {
      // Delete from storage
      const path = file_url.split('/deal-attachments/')[1];
      if (path) {
        await supabase.storage.from('deal-attachments').remove([path]);
      }
      
      // Delete record
      const { error } = await supabase
        .from('crm_deal_attachments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal-attachments', variables.deal_id] });
    },
  });
}
