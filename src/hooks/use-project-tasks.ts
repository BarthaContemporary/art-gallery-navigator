
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export interface ProjectTask {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  assigned_to: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface TaskWithAssignee extends ProjectTask {
  assignee: {
    display_name: string;
    avatar_url: string | null;
  } | null;
}

export interface CreateTaskInput {
  project_id: string;
  name: string;
  description?: string;
  status: 'active' | 'scheduled' | 'completed' | 'abandoned';
  assigned_to?: string;
  start_date: string;
  end_date: string;
  references?: {
    type: 'document' | 'collection' | 'artwork' | 'artist';
    id: string;
  }[];
}

export function useProjectTasks(projectId: string | undefined, filters?: {
  status?: string;
  assignedTo?: string;
}) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['project-tasks', projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];
      
      let query = supabase
        .from('project_tasks')
        .select(`
          *,
          assignee:profiles!inner(display_name, avatar_url)
        `)
        .eq('project_id', projectId);
      
      if (filters?.status && filters.status !== "") {
        query = query.eq('status', filters.status as 'active' | 'scheduled' | 'completed' | 'abandoned');
      }
      
      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }
      
      const { data, error } = await query.order('start_date', { ascending: true });
      
      if (error) throw error;
      
      // Transform the data to ensure it matches TaskWithAssignee type
      const tasksWithAssignees = data.map(task => {
        // Handle the case where assignee might be null or have a different structure
        let assignee = null;
        
        if (task.assignee && 
            typeof task.assignee === 'object' && 
            !Array.isArray(task.assignee) && 
            task.assignee !== null) {
          // Type assertion to work with the data
          const assigneeData = task.assignee as unknown as { display_name?: string; avatar_url?: string | null };
          if (assigneeData && typeof assigneeData === 'object') {
            assignee = {
              display_name: assigneeData.display_name || 'Unknown',
              avatar_url: assigneeData.avatar_url || null
            };
          }
        }
          
        return {
          ...task,
          assignee
        } as TaskWithAssignee;
      });
      
      return tasksWithAssignees;
    },
    enabled: !!projectId && !!user
  });
}

export function useProjectTask(taskId: string | undefined) {
  return useQuery({
    queryKey: ['project-task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      
      const { data, error } = await supabase
        .from('project_tasks')
        .select(`
          *,
          assignee:profiles!inner(display_name, avatar_url)
        `)
        .eq('id', taskId)
        .single();
      
      if (error) throw error;
      
      // Handle the case where assignee might be null or have a different structure
      let assignee = null;
      
      if (data.assignee && 
          typeof data.assignee === 'object' && 
          !Array.isArray(data.assignee) && 
          data.assignee !== null) {
        // Type assertion to work with the data
        const assigneeData = data.assignee as unknown as { display_name?: string; avatar_url?: string | null };
        if (assigneeData && typeof assigneeData === 'object') {
          assignee = {
            display_name: assigneeData.display_name || 'Unknown',
            avatar_url: assigneeData.avatar_url || null
          };
        }
      }
          
      return {
        ...data,
        assignee
      } as TaskWithAssignee;
    },
    enabled: !!taskId
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { references, ...taskData } = input;
      
      // First create the task
      const { data: task, error } = await supabase
        .from('project_tasks')
        .insert(taskData)
        .select()
        .single();
      
      if (error) throw error;
      
      // Then add references if provided
      if (references && references.length > 0) {
        const taskReferences = references.map(ref => ({
          task_id: task.id,
          reference_type: ref.type,
          reference_id: ref.id
        }));
        
        const { error: referencesError } = await supabase
          .from('project_task_references')
          .insert(taskReferences);
        
        if (referencesError) throw referencesError;
      }
      
      return task;
    },
    onSuccess: (result) => {
      toast.success("Task created successfully");
      queryClient.invalidateQueries({ queryKey: ['project-tasks', result.project_id] });
    },
    onError: (error) => {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    }
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<CreateTaskInput> }) => {
      const { references, ...taskData } = data;
      
      // Update the task
      const { error } = await supabase
        .from('project_tasks')
        .update(taskData)
        .eq('id', id);
      
      if (error) throw error;
      
      // Update references if provided
      if (references !== undefined) {
        // First delete all existing references
        const { error: deleteError } = await supabase
          .from('project_task_references')
          .delete()
          .eq('task_id', id);
        
        if (deleteError) throw deleteError;
        
        // Then add the new references
        if (references.length > 0) {
          const taskReferences = references.map(ref => ({
            task_id: id,
            reference_type: ref.type,
            reference_id: ref.id
          }));
          
          const { error: referencesError } = await supabase
            .from('project_task_references')
            .insert(taskReferences);
          
          if (referencesError) throw referencesError;
        }
      }
      
      return { id };
    },
    onSuccess: () => {
      toast.success("Task updated successfully");
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    },
    onError: (error) => {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      toast.success("Task deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    },
    onError: (error) => {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  });
}

// Hook to get task references
export function useTaskReferences(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-references', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      const { data, error } = await supabase
        .from('project_task_references')
        .select(`
          *
        `)
        .eq('task_id', taskId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!taskId
  });
}
