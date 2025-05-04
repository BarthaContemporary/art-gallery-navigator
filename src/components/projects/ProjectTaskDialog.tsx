
import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskWithAssignee, useCreateTask, useUpdateTask, CreateTaskInput } from "@/hooks/use-project-tasks";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { useProjectUsers } from "@/hooks/use-projects";
import { ReferenceSelector } from "./ReferenceSelector";

interface ProjectTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  task?: TaskWithAssignee;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "scheduled", "completed", "abandoned"]),
  assigned_to: z.string().optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  project_id: z.string().min(1, "Project ID is required"),
});

export function ProjectTaskDialog({ open, onOpenChange, projectId, task }: ProjectTaskDialogProps) {
  const { data: projectUsers } = useProjectUsers(projectId);
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [references, setReferences] = useState<{type: 'document' | 'collection' | 'artwork' | 'artist', id: string}[]>([]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
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
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
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
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleReferencesChange = (refs: {type: 'document' | 'collection' | 'artwork' | 'artist', id: string}[]) => {
    setReferences(refs);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {task ? "Edit Task" : "Create Task"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Task name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Task description (optional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="abandoned">Abandoned</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned To</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign to user (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {projectUsers?.map(user => {
                          // Fixed TypeScript error with proper null check
                          let displayName = "User";
                          if (user.profiles && 
                              typeof user.profiles === 'object' && 
                              user.profiles !== null) {
                            displayName = user.profiles.display_name || "User";
                          }
                          
                          return (
                            <SelectItem key={user.user_id} value={user.user_id}>
                              {displayName}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormItem>
              <FormLabel>References</FormLabel>
              <ReferenceSelector onReferencesChange={handleReferencesChange} />
            </FormItem>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? task
                    ? "Updating..."
                    : "Creating..."
                  : task
                  ? "Update Task"
                  : "Create Task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
