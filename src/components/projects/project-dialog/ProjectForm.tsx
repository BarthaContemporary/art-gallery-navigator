
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { format } from "date-fns";
import { ProjectWithLocation, CreateProjectInput, useCreateProject, useUpdateProject } from "@/hooks/projects";
import { useProjectMembers } from "@/hooks/projects/use-project-members";
import { ProjectFormSchema } from "./schema";
import { BasicInfoFields } from "./BasicInfoFields";
import { ProjectTypeStatusFields } from "./ProjectTypeStatusFields";
import { LocationField } from "./LocationField";
import { DateFields } from "./DateFields";
import { ProjectUserEmailInput } from "@/components/projects/ProjectUserEmailInput";
import * as z from "zod";

type FormValues = z.infer<typeof ProjectFormSchema>;

interface ProjectFormProps {
  project?: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  
  // For existing projects, fetch associated members
  const { data: projectMembers = [] } = useProjectMembers(project?.id);
  
  const [userNames, setUserNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Extract usernames from project members when available
  useEffect(() => {
    if (Array.isArray(projectMembers) && projectMembers.length > 0) {
      // Extract display names from the members
      const names = projectMembers
        .map(member => member.display_name)
        .filter((name): name is string => !!name); // Filter out null/undefined
      
      setUserNames(names);
    }
  }, [projectMembers]);
  
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
        user_emails: userNames,
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
  
  const handleUserNamesChange = (names: string[]) => {
    setUserNames(names);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <BasicInfoFields control={form.control} />
        
        <ProjectTypeStatusFields control={form.control} />
        
        <LocationField control={form.control} />
        
        <DateFields control={form.control} />
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Project Team Members (by Username)</label>
          <ProjectUserEmailInput
            onEmailsChange={handleUserNamesChange}
            initialEmails={userNames}
          />
          <p className="text-xs text-muted-foreground">
            Enter display names of team members to invite to this project
          </p>
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
