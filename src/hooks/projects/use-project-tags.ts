import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProjectTag {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export interface TaskTag {
  task_id: string;
  tag_id: string;
  tag?: ProjectTag;
}

export function useProjectTags(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-tags', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_tags')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as ProjectTag[];
    },
    enabled: !!projectId,
  });
}

export function useTaskTags(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-tags', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_tags')
        .select(`
          *,
          tag:project_tags(*)
        `)
        .eq('task_id', taskId);
      
      if (error) throw error;
      return data as TaskTag[];
    },
    enabled: !!taskId,
  });
}

export function useCreateProjectTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ project_id, name, color }: { project_id: string; name: string; color?: string }) => {
      const { data, error } = await supabase
        .from('project_tags')
        .insert({ project_id, name, color })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-tags', variables.project_id] });
    },
  });
}

export function useAddTagToTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ task_id, tag_id }: { task_id: string; tag_id: string }) => {
      const { data, error } = await supabase
        .from('task_tags')
        .insert({ task_id, tag_id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-tags', variables.task_id] });
    },
  });
}

export function useRemoveTagFromTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ task_id, tag_id }: { task_id: string; tag_id: string }) => {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', task_id)
        .eq('tag_id', tag_id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-tags', variables.task_id] });
    },
  });
}

export function useDeleteProjectTag() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from('project_tags')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-tags', variables.project_id] });
    },
  });
}
