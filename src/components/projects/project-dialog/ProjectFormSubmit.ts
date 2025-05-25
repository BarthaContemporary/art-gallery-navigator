import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { ProjectWithLocation, CreateProjectInput, useCreateProject, useUpdateProject } from "@/hooks/projects";
import { z } from "zod";
import { ProjectFormSchema } from "./schema";
import { useNavigate } from "react-router-dom";

// FormValues type can be inferred if not used explicitly elsewhere
// type FormValues = z.infer<typeof ProjectFormSchema>;

export function useProjectFormSubmit(project?: ProjectWithLocation, onClose?: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { mutateAsync: createProject } = useCreateProject();
  const { mutateAsync: updateProject } = useUpdateProject();
  const navigate = useNavigate();

  // userEmails parameter removed from onSubmit
  const onSubmit = async (values: z.infer<typeof ProjectFormSchema>) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setFormError(null);
    
    try {
      if (project) {
        // Update existing project
        await updateProject({
          id: project.id,
          data: {
            ...values,
            // user_emails: userEmails // Removed: No longer passing userEmails
          }
        });
        
        toast.success("Project updated");
        queryClient.invalidateQueries({ queryKey: ['project', project.id] });
        // Invalidate project-members query as well if admins can still remove members,
        // though this form doesn't directly touch members anymore.
        // It's safer to keep it if other parts of the app might change members.
        // For now, since this form no longer handles members, we might not need to invalidate ['project-members'] here.
        // However, if project updates could implicitly affect member display or status, keep it.
        // Given the RLS changes, 'project-members' might refetch anyway for admins.
        // queryClient.invalidateQueries({ queryKey: ['project-members', project.id] });
      } else {
        // Create new project
        const projectData: CreateProjectInput = {
          name: values.name,
          description: values.description || "",
          status: values.status,
          type: values.type,
          location_id: values.location_id || null,
          start_date: values.start_date,
          end_date: values.end_date,
          // user_emails: userEmails // Removed: No longer passing userEmails
        };
        
        const newProject = await createProject(projectData);
        
        toast.success("Project created");
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        
        if (newProject?.id) {
          navigate(`/projects/${newProject.id}`);
        }
      }
      
      if (onClose) onClose();
    } catch (error: any) {
      console.error('Error submitting project form:', error);
      setFormError(error?.message || 'Something went wrong. Please try again.');
      toast.error('Failed to save project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return { onSubmit, isSubmitting, formError };
}
