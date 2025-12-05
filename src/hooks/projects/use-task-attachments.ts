import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskAttachment {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
  uploader?: {
    display_name: string | null;
  };
}

export function useTaskAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-attachments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_attachments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch uploader profiles separately
      const uploaderIds = [...new Set(data.map(a => a.uploaded_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', uploaderIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(attachment => ({
        ...attachment,
        uploader: profileMap.get(attachment.uploaded_by),
      })) as TaskAttachment[];
    },
    enabled: !!taskId,
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ task_id, file }: { task_id: string; file: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${task_id}/${crypto.randomUUID()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);
      
      // Create attachment record
      const { data, error } = await supabase
        .from('task_attachments')
        .insert({
          task_id,
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
      queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.task_id] });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, task_id, file_url }: { id: string; task_id: string; file_url: string }) => {
      // Delete from storage
      const path = file_url.split('/task-attachments/')[1];
      if (path) {
        await supabase.storage.from('task-attachments').remove([path]);
      }
      
      // Delete record
      const { error } = await supabase
        .from('task_attachments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-attachments', variables.task_id] });
    },
  });
}
