
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ProjectWithLocation, CreateProjectInput, useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { useLocation } from "@/hooks/use-location";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocations } from "@/hooks/use-locations";
import { format } from "date-fns";
import { UserMultiSelect } from "./UserMultiSelect";

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectWithLocation;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "scheduled", "completed", "abandoned"]),
  type: z.enum(["exhibition", "fair", "publication", "talk", "other"]),
  location_id: z.string().optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  users: z.array(z.string()).optional(),
});

export function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const { data: locations } = useLocations();
  const { data: locationData } = useLocation(project?.location_id || undefined);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name || "",
      description: project?.description || "",
      status: project?.status || "scheduled",
      type: project?.type || "exhibition",
      location_id: project?.location_id || undefined,
      start_date: project?.start_date ? format(new Date(project.start_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      end_date: project?.end_date ? format(new Date(project.end_date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      users: [],
    }
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      // Ensure all required fields are present
      const projectData: CreateProjectInput = {
        name: values.name,
        description: values.description,
        status: values.status,
        type: values.type,
        location_id: values.location_id,
        start_date: values.start_date,
        end_date: values.end_date,
        users: selectedUsers,
      };
      
      if (project) {
        await updateProject.mutateAsync({ id: project.id, data: projectData });
      } else {
        await createProject.mutateAsync(projectData);
      }
      
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleUserSelection = (userIds: string[]) => {
    setSelectedUsers(userIds);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {project ? "Edit Project" : "Create Project"}
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
                    <Input placeholder="Project name" {...field} />
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
                    <Textarea placeholder="Project description (optional)" {...field} />
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
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="exhibition">Exhibition</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                        <SelectItem value="publication">Publication</SelectItem>
                        <SelectItem value="talk">Talk</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="location_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location (optional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {locations?.map(location => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
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
              <FormLabel>Project Users</FormLabel>
              <FormControl>
                <UserMultiSelect
                  onSelectionChange={handleUserSelection}
                  initialSelectedIds={selectedUsers}
                />
              </FormControl>
              <FormMessage />
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
                  ? project
                    ? "Updating..."
                    : "Creating..."
                  : project
                  ? "Update Project"
                  : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
