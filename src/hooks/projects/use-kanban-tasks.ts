import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KanbanTask, MoveTaskInput } from "./types/section-types";

export function useKanbanTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['kanban-tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true });
      
      if (error) {
        console.error("Error fetching kanban tasks:", error);
        throw error;
      }
      
      if (!data || data.length === 0) return [];
      
      // Get assignee info
      const assigneeIds = data
        .map(task => task.assigned_to)
        .filter((id): id is string => id !== null);
      
      const uniqueAssigneeIds = [...new Set(assigneeIds)];
      
      let assigneeProfileMap = new Map();
      
      if (uniqueAssigneeIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', uniqueAssigneeIds);
        
        profiles?.forEach(profile => {
          assigneeProfileMap.set(profile.id, {
            display_name: profile.display_name || 'Unknown',
            avatar_url: profile.avatar_url
          });
        });
      }
      
      return data.map(task => ({
        ...task,
        priority: task.priority || 'medium',
        position: task.position || 0,
        assignee: task.assigned_to ? assigneeProfileMap.get(task.assigned_to) || null : null
      })) as KanbanTask[];
    },
    enabled: !!projectId,
  });
}

export function useMoveTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ taskId, targetSectionId, newPosition }: MoveTaskInput) => {
      const { error } = await supabase
        .from('project_tasks')
        .update({ 
          section_id: targetSectionId,
          position: newPosition
        })
        .eq('id', taskId);
      
      if (error) throw error;
      return { taskId, targetSectionId, newPosition };
    },
    onMutate: async ({ taskId, targetSectionId, newPosition }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['kanban-tasks'] });
      
      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(['kanban-tasks']);
      
      // Optimistically update
      queryClient.setQueryData(['kanban-tasks'], (old: KanbanTask[] | undefined) => {
        if (!old) return old;
        return old.map(task => 
          task.id === taskId 
            ? { ...task, section_id: targetSectionId, position: newPosition }
            : task
        );
      });
      
      return { previousTasks };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(['kanban-tasks'], context.previousTasks);
      }
      toast.error('Failed to move task');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    }
  });
}

export function useUpdateTaskPosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (tasks: Array<{ id: string; position: number; section_id: string | null }>) => {
      const updates = tasks.map(({ id, position, section_id }) =>
        supabase
          .from('project_tasks')
          .update({ position, section_id })
          .eq('id', id)
      );
      
      const results = await Promise.allSettled(updates);
      const errors = results.filter(r => r.status === 'rejected');
      
      if (errors.length > 0) {
        throw new Error('Failed to update some task positions');
      }
      
      return tasks;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    }
  });
}

export function useUpdateTaskPriority() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ taskId, priority }: { taskId: string; priority: string }) => {
      const { error } = await supabase
        .from('project_tasks')
        .update({ priority })
        .eq('id', taskId);
      
      if (error) throw error;
      return { taskId, priority };
    },
    onSuccess: () => {
      toast.success('Priority updated');
      queryClient.invalidateQueries({ queryKey: ['kanban-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update priority: ${error.message}`);
    }
  });
}
