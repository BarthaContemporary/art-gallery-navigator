
import { useState, useEffect, useCallback } from "react";
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
import { toast } from "sonner";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";

type FormValues = z.infer<typeof ProjectFormSchema>;

interface ProjectFormProps {
  project?: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();
  
  // For existing projects, fetch associated members
  const { data: projectMembers = [], isLoading: isLoadingMembers, isError: membersError } = 
    useProjectMembers(project?.id);
  
  const [userNames, setUserNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Extract usernames from project members when available - with memoization to prevent unnecessary re-renders
  const processMembers = useCallback(() => {
    if (Array.isArray(projectMembers) && projectMembers.length > 0) {
      const names = projectMembers
        .map(member => member.display_name)
        .filter((name): name is string => !!name);
      
      setUserNames(names);
    }
  }, [projectMembers]);
  
  useEffect(() => {
    processMembers();
  }, [projectMembers, processMembers]);

  // Show error if members couldn't be loaded
  useEffect(() => {
    if (membersError && project) {
      toast.error("Failed to load project members");
    }
  }, [membersError, project]);
  
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
    setFormError(null);
    setIsSubmitting(true);
    
    try {
      if (!values.name.trim()) {
        setFormError("Project name is required");
        setIsSubmitting(false);
        return;
      }
      
      // Validate dates
      const startDate = new Date(values.start_date);
      const endDate = new Date(values.end_date);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        setFormError("Invalid date format");
        setIsSubmitting(false);
        return;
      }
      
      if (startDate > endDate) {
        setFormError("End date must be after start date");
        setIsSubmitting(false);
        return;
      }
      
      // Ensure all required fields are present
      const projectData: CreateProjectInput = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        status: values.status,
        type: values.type,
        location_id: values.location_id || null,
        start_date: values.start_date,
        end_date: values.end_date,
        user_emails: userNames.filter(name => name.trim() !== ""),
      };
      
      if (project) {
        await updateProject.mutateAsync({ 
          id: project.id, 
          data: projectData 
        });
      } else {
        await createProject.mutateAsync(projectData);
      }
      
      // Force invalidate project members query to ensure the list is updated
      if (project?.id) {
        queryClient.invalidateQueries({ queryKey: ['project-members', project.id] });
      }
      
      onClose();
    } catch (error: any) {
      console.error("Error submitting project:", error);
      setFormError(error?.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleUserNamesChange = useCallback((names: string[]) => {
    setUserNames(names);
  }, []);
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <BasicInfoFields control={form.control} />
        
        <ProjectTypeStatusFields control={form.control} />
        
        <LocationField control={form.control} />
        
        <DateFields control={form.control} />
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Project Team Members</label>
          
          {isLoadingMembers && project ? (
            <div className="text-sm text-muted-foreground">Loading team members...</div>
          ) : (
            <ProjectUserEmailInput
              onEmailsChange={handleUserNamesChange}
              initialEmails={userNames}
            />
          )}
          
          <p className="text-xs text-muted-foreground">
            Enter display names of team members to invite to this project.
            This will grant them access to view and edit the project.
          </p>
        </div>
        
        {formError && (
          <div className="text-sm font-medium text-destructive">{formError}</div>
        )}
        
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
