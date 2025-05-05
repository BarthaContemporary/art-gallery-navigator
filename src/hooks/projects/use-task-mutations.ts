
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateTaskInput, UpdateTaskInput } from "./types/task-types";

export function useCreateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { references, ...taskData } = input;
      
      try {
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
          
          if (referencesError) {
            console.error("Error creating task references:", referencesError);
            // Continue anyway as the main task was created
            toast.warning("Task was created but references couldn't be added");
          }
        }
        
        return task;
      } catch (error: any) {
        console.error("Error creating task:", error);
        
        // Handle specific error cases
        if (error.code === '42P17') {
          throw new Error("Permission error: You may not have access to create tasks in this project");
        }
        
        throw error;
      }
    },
    onSuccess: (result) => {
      toast.success("Task created successfully");
      queryClient.invalidateQueries({ queryKey: ['project-tasks', result.project_id] });
    },
    onError: (error: any) => {
      console.error("Task creation error:", error);
      toast.error(`Failed to create task: ${error.message || "Unknown error"}`);
    }
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: UpdateTaskInput) => {
      const { references, ...taskData } = data;
      
      try {
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
            
            if (referencesError) {
              console.error("Error updating task references:", referencesError);
              // Continue anyway as the main task was updated
              toast.warning("Task was updated but references couldn't be modified");
            }
          }
        }
        
        return { id };
      } catch (error: any) {
        console.error("Error updating task:", error);
        
        // Handle specific error cases
        if (error.code === '42P17') {
          throw new Error("Permission error: You may not have access to update tasks in this project");
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Task updated successfully");
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    },
    onError: (error: any) => {
      console.error("Task update error:", error);
      toast.error(`Failed to update task: ${error.message || "Unknown error"}`);
    }
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase
          .from('project_tasks')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        return { id };
      } catch (error: any) {
        console.error("Error deleting task:", error);
        
        // Handle specific error cases
        if (error.code === '42P17') {
          throw new Error("Permission error: You may not have access to delete tasks in this project");
        }
        
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Task deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
    },
    onError: (error: any) => {
      console.error("Task deletion error:", error);
      toast.error(`Failed to delete task: ${error.message || "Unknown error"}`);
    }
  });
}
