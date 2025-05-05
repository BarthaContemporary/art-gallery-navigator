
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { format } from "date-fns";
import { ProjectWithLocation, CreateProjectInput, useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { UserMultiSelect } from "../UserMultiSelect";
import { useProjectUsers } from "@/hooks/use-projects";
import { ProjectFormSchema } from "./schema";
import { BasicInfoFields } from "./BasicInfoFields";
import { ProjectTypeStatusFields } from "./ProjectTypeStatusFields";
import { LocationField } from "./LocationField";
import { DateFields } from "./DateFields";
import * as z from "zod"; // Added this import to fix the error

type FormValues = z.infer<typeof ProjectFormSchema>;

interface ProjectFormProps {
  project?: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  
  // Fetch project users if editing an existing project
  const { data: projectUsers = [] } = useProjectUsers(project?.id);
  
  // Defensively ensure we have a valid array of user IDs
  const initialUserIds = Array.isArray(projectUsers) && projectUsers.length > 0
    ? projectUsers.filter(pu => pu && pu.user_id).map(pu => pu.user_id)
    : [];
  
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Update selectedUsers when projectUsers changes
  useEffect(() => {
    try {
      if (Array.isArray(projectUsers) && projectUsers.length > 0) {
        const validUserIds = projectUsers
          .filter(pu => pu && pu.user_id)
          .map(pu => pu.user_id);
        setSelectedUsers(validUserIds);
      }
    } catch (error) {
      console.error("Error processing project users:", error);
      setSelectedUsers([]);
    }
  }, [projectUsers]);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(ProjectFormSchema),
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
  
  const onSubmit = async (values: FormValues) => {
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
      
      onClose();
    } catch (error) {
      console.error("Error submitting project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleUserSelection = (userIds: string[]) => {
    // Ensure userIds is always an array
    const safeUserIds = Array.isArray(userIds) ? userIds : [];
    setSelectedUsers(safeUserIds);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <BasicInfoFields control={form.control} />
        
        <ProjectTypeStatusFields control={form.control} />
        
        <LocationField control={form.control} />
        
        <DateFields control={form.control} />
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Project Users</label>
          <UserMultiSelect
            onSelectionChange={handleUserSelection}
            initialSelectedIds={selectedUsers}
          />
        </div>
        
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
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
  );
}
