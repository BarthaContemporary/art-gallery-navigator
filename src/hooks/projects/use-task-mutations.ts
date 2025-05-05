
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateTaskInput, UpdateTaskInput } from "./types/task-types";

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
          reference_type: ref.type as 'document' | 'collection' | 'artwork' | 'artist',
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
    mutationFn: async ({ id, data }: UpdateTaskInput) => {
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
            reference_type: ref.type as 'document' | 'collection' | 'artwork' | 'artist',
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
