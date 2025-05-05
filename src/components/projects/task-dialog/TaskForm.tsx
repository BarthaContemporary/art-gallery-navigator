
import { useState } from "react";
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
  useTaskReferences 
} from "@/hooks/use-project-tasks";
import { useProjectMembers } from "@/hooks/projects/use-project-members";

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
  const { data: projectMembers = [] } = useProjectMembers(projectId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [references, setReferences] = useState<{type: 'document' | 'collection' | 'artwork' | 'artist', id: string}[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: task?.name || "",
      description: task?.description || "",
      status: task?.status || "scheduled",
      assigned_to: task?.assigned_to || undefined,
      start_date: task?.start_date ? format(new Date(task.start_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      end_date: task?.end_date ? format(new Date(task.end_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      project_id: projectId,
    }
  });

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      if (task) {
        await updateTask.mutateAsync({
          id: task.id,
          data: {
            name: values.name,
            description: values.description,
            status: values.status,
            assigned_to: values.assigned_to,
            start_date: values.start_date,
            end_date: values.end_date,
            project_id: values.project_id,
            references
          }
        });
      } else {
        const taskInput: CreateTaskInput = {
          name: values.name,
          description: values.description,
          status: values.status,
          assigned_to: values.assigned_to,
          start_date: values.start_date,
          end_date: values.end_date,
          project_id: values.project_id,
          references
        };
        await createTask.mutateAsync(taskInput);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReferencesChange = (refs: {type: 'document' | 'collection' | 'artwork' | 'artist', id: string}[]) => {
    setReferences(refs);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <TaskBasicFields control={form.control} />
        
        <div className="grid grid-cols-2 gap-4">
          <TaskStatusField control={form.control} />
          <TaskAssigneeField control={form.control} projectUsers={projectMembers} />
        </div>
        
        <TaskDateFields control={form.control} />
        <TaskReferencesField onReferencesChange={handleReferencesChange} />
        
        <TaskFormActions 
          isSubmitting={isSubmitting} 
          onCancel={onClose}
          isEditing={!!task}
        />
      </form>
    </Form>
  );
}
