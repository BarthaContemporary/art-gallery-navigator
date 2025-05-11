
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ProjectWithLocation, CreateProjectInput, useCreateProject, useUpdateProject } from "@/hooks/projects";
import { z } from "zod";
import { ProjectFormSchema } from "./schema";

type FormValues = z.infer<typeof ProjectFormSchema>;

export function useProjectFormSubmit(
  project: ProjectWithLocation | undefined,
  onClose: () => void
) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const queryClient = useQueryClient();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const onSubmit = async (values: FormValues, userEmails: string[]) => {
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
        user_emails: userEmails.filter(email => email.trim() !== ""),
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
  
  return {
    onSubmit,
    isSubmitting,
    formError,
  };
}
