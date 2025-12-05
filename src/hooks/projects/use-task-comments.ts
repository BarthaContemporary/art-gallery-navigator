import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  mentions: string[] | null;
  created_at: string;
  edited_at: string | null;
  user?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch user profiles separately
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(comment => ({
        ...comment,
        user: profileMap.get(comment.user_id),
      })) as TaskComment[];
    },
    enabled: !!taskId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ task_id, content, mentions }: { task_id: string; content: string; mentions?: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('task_comments')
        .insert({ task_id, content, mentions, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      
      // Create notifications for mentioned users
      if (mentions && mentions.length > 0) {
        const notifications = mentions.map(userId => ({
          user_id: userId,
          type: 'mention',
          title: 'You were mentioned in a comment',
          message: content.substring(0, 100),
          link: `/projects?task=${task_id}`,
        }));
        
        await supabase.from('in_app_notifications').insert(notifications);
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', variables.task_id] });
      queryClient.invalidateQueries({ queryKey: ['task-activity', variables.task_id] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', variables.task_id] });
    },
  });
}
