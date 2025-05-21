
import React, { useState, useEffect } from "react"; // Added useEffect
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form } from "@/components/ui/form";
import { format } from "date-fns";
import { z } from "zod";
import { 
  CreateTaskInput, 
  useCreateTask, 
  useUpdateTask, 
  TaskWithAssignee, 
  useTaskReferences, // Already imported, ensure it's used
  useProjectMembers,
  ProjectMember
} from "@/hooks/projects";
import { toast } from "sonner";

import { taskFormSchema } from "./schema";
import { TaskBasicFields } from "./TaskBasicFields";
import { TaskStatusField } from "./TaskStatusField";
import { TaskAssigneeField } from "./TaskAssigneeField";
import { TaskDateFields } from "./TaskDateFields";
import { TaskReferencesField } from "./TaskReferencesField";
import { TaskFormActions } from "./TaskFormActions";

type FormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  projectId: string;
  task?: TaskWithAssignee;
  onClose: () => void;
}

export function TaskForm({ projectId, task, onClose }: TaskFormProps) {
  const { members = [], isError: membersError } = useProjectMembers(projectId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch named references for display in ReferenceSelector when editing
  const { data: initialNamedReferencesForField, isLoading: referencesLoading } = useTaskReferences(task?.id);

  // State for references to be submitted to backend (id, type only)
  const [referencesForPayload, setReferencesForPayload] = useState<Array<{type: 'document' | 'collection' | 'artwork' | 'artist', id: string}>>(
    () => task?.references || [] // Initialize with existing references (id, type) if editing
  );

  // Effect to update referencesForPayload if the task prop (and its references) changes
  useEffect(() => {
    if (task && task.references) {
      setReferencesForPayload(task.references);
    } else if (!task) { // Handles switching from edit to create mode if applicable
      setReferencesForPayload([]);
    }
  }, [task]); // Depend on the task object itself

  const form = useForm<FormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: task?.name || "",
      description: task?.description || "",
      status: task?.status || "scheduled",
      assigned_to: task?.assigned_to || undefined,
      start_date: task?.start_date ? format(new Date(task.start_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      end_date: task?.end_date ? format(new Date(task.end_date), "yyyy-MM-dd") : format(new Date(new Date().setDate(new Date().getDate() + 7)), "yyyy-MM-dd"),
      project_id: projectId,
    }
  });

  if (membersError) {
    toast.warning("Could not load team members for task assignment. Some features may be limited.");
  }

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);
    
    const taskDataPayload = {
      name: values.name,
      description: values.description,
      status: values.status,
      assigned_to: values.assigned_to === "unassigned" ? null : values.assigned_to,
      start_date: values.start_date,
      end_date: values.end_date,
      project_id: values.project_id,
      references: referencesForPayload // Use the state holding {id, type}
    };

    try {
      if (task) {
        await updateTask.mutateAsync({
          id: task.id,
          data: taskDataPayload
        });
        toast.success("Task updated successfully");
      } else {
        const taskInput: CreateTaskInput = taskDataPayload;
        await createTask.mutateAsync(taskInput);
        toast.success("Task created successfully");
      }
      onClose();
    } catch (err: any) {
      console.error("Error in task form submission:", err);
      const errorMessage = err.message || (task ? "An error occurred while updating the task" : "An error occurred while creating the task");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // This handler receives {id, type} from ReferenceSelector (via TaskReferencesField)
  const handleReferencesChange = (refs: {type: 'document' | 'collection' | 'artwork' | 'artist', id: string}[]) => {
    setReferencesForPayload(refs);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}
        
        <TaskBasicFields control={form.control} />
        
        <div className="grid grid-cols-2 gap-4">
          <TaskStatusField control={form.control} />
          <TaskAssigneeField 
            control={form.control} 
            projectUsers={members as ProjectMember[] || []}
          />
        </div>
        
        <TaskDateFields control={form.control} />
        <TaskReferencesField 
          initialReferences={initialNamedReferencesForField} // Pass fetched named references
          onReferencesChange={handleReferencesChange} 
        />
        
        <TaskFormActions 
          isSubmitting={isSubmitting} 
          onCancel={onClose}
          isEditing={!!task}
        />
      </form>
    </Form>
  );
}
