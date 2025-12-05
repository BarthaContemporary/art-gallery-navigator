import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { z } from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUpdateTask, TaskWithAssignee, useProjectMembers } from "@/hooks/projects";
import { TaskSubtasks } from "./TaskSubtasks";
import { TaskComments } from "./TaskComments";
import { TaskAttachments } from "./TaskAttachments";
import { TaskActivityLog } from "./TaskActivityLog";
import { TaskPriorityField } from "./TaskPriorityField";
import { TaskTagsField } from "./TaskTagsField";
import { TaskStatusField } from "../task-dialog/TaskStatusField";
import { TaskAssigneeField } from "../task-dialog/TaskAssigneeField";
import { toast } from "sonner";
import { X, Calendar, Clock, User } from "lucide-react";

const taskSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "scheduled", "completed", "abandoned"]),
  priority: z.string().optional(),
  assigned_to: z.string().optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  estimated_hours: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof taskSchema>;

interface EnhancedTaskPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskWithAssignee;
  projectId: string;
}

export function EnhancedTaskPanel({ open, onOpenChange, task, projectId }: EnhancedTaskPanelProps) {
  const [activeTab, setActiveTab] = useState("details");
  const updateTask = useUpdateTask();
  const { members = [] } = useProjectMembers(projectId);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: task.name,
      description: task.description || "",
      status: task.status,
      priority: task.priority || "medium",
      assigned_to: task.assigned_to || undefined,
      start_date: task.start_date ? format(new Date(task.start_date), "yyyy-MM-dd") : "",
      end_date: task.end_date ? format(new Date(task.end_date), "yyyy-MM-dd") : "",
      estimated_hours: task.estimated_hours || undefined,
    },
  });
  
  const onSubmit = async (values: FormValues) => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: {
          name: values.name,
          description: values.description,
          status: values.status,
          priority: values.priority as "critical" | "high" | "medium" | "low" | undefined,
          assigned_to: values.assigned_to === "unassigned" ? null : values.assigned_to,
          start_date: values.start_date,
          end_date: values.end_date,
          estimated_hours: values.estimated_hours,
        },
      });
      toast.success("Task updated");
    } catch (error) {
      toast.error("Failed to update task");
    }
  };
  
  const handlePriorityChange = (priority: string) => {
    form.setValue("priority", priority);
    form.handleSubmit(onSubmit)();
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold truncate">
                {task.name}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                Task details and activity
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="px-6 border-b border-border bg-transparent h-auto p-0 justify-start">
            <TabsTrigger value="details" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">
              Details
            </TabsTrigger>
            <TabsTrigger value="subtasks" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">
              Subtasks
            </TabsTrigger>
            <TabsTrigger value="comments" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">
              Comments
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 py-2">
              Activity
            </TabsTrigger>
          </TabsList>
          
          <ScrollArea className="flex-1">
            <TabsContent value="details" className="p-6 m-0 space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Task Name</FormLabel>
                        <FormControl>
                          <Input {...field} onBlur={() => form.handleSubmit(onSubmit)()} />
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
                          <Textarea 
                            {...field} 
                            className="min-h-[100px] resize-none"
                            onBlur={() => form.handleSubmit(onSubmit)()}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <TaskStatusField control={form.control} />
                    <TaskPriorityField 
                      value={form.watch("priority") || null} 
                      onChange={handlePriorityChange} 
                    />
                  </div>
                  
                  <TaskAssigneeField control={form.control} projectUsers={members} />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Start Date
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              onChange={(e) => {
                                field.onChange(e);
                                form.handleSubmit(onSubmit)();
                              }}
                            />
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
                          <FormLabel className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Due Date
                          </FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field}
                              onChange={(e) => {
                                field.onChange(e);
                                form.handleSubmit(onSubmit)();
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="estimated_hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Estimated Hours
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            step="0.5"
                            {...field}
                            onBlur={() => form.handleSubmit(onSubmit)()}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
              
              <Separator />
              
              <TaskTagsField taskId={task.id} projectId={projectId} />
              
              <Separator />
              
              <TaskAttachments taskId={task.id} />
            </TabsContent>
            
            <TabsContent value="subtasks" className="p-6 m-0">
              <TaskSubtasks taskId={task.id} />
            </TabsContent>
            
            <TabsContent value="comments" className="p-6 m-0">
              <TaskComments taskId={task.id} projectId={projectId} />
            </TabsContent>
            
            <TabsContent value="activity" className="p-6 m-0">
              <TaskActivityLog taskId={task.id} />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
