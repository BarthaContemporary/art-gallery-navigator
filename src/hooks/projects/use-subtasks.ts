import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Subtask {
  id: string;
  task_id: string;
  name: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as Subtask[];
    },
    enabled: !!taskId,
  });
}

export function useCreateSubtask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ task_id, name, position }: { task_id: string; name: string; position: number }) => {
      const { data, error } = await supabase
        .from('subtasks')
        .insert({ task_id, name, position })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', variables.task_id] });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, name, is_completed, task_id }: { id: string; name?: string; is_completed?: boolean; task_id: string }) => {
      const updates: Partial<Subtask> = {};
      if (name !== undefined) updates.name = name;
      if (is_completed !== undefined) updates.is_completed = is_completed;
      
      const { data, error } = await supabase
        .from('subtasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', variables.task_id] });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, task_id }: { id: string; task_id: string }) => {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', variables.task_id] });
    },
  });
}
