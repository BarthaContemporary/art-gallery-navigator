
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { format } from "date-fns";
import { ProjectWithLocation, CreateProjectInput, useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { useProjectUsers } from "@/hooks/use-projects";
import { ProjectFormSchema } from "./schema";
import { BasicInfoFields } from "./BasicInfoFields";
import { ProjectTypeStatusFields } from "./ProjectTypeStatusFields";
import { LocationField } from "./LocationField";
import { DateFields } from "./DateFields";
import { ProjectUserEmailInput } from "@/components/projects/ProjectUserEmailInput";
import { supabase } from "@/integrations/supabase/client";
import * as z from "zod";

type FormValues = z.infer<typeof ProjectFormSchema>;

interface ProjectFormProps {
  project?: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  
  // For existing projects, fetch associated emails
  const { data: projectUsers = [] } = useProjectUsers(project?.id);
  
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Extract emails from project users when available - retrieve via separate query
  useEffect(() => {
    try {
      // If we have project users, fetch their email addresses
      if (Array.isArray(projectUsers) && projectUsers.length > 0) {
        const fetchUserEmails = async () => {
          const userIds = projectUsers.map(pu => pu.user_id);
          
          // Query the profiles table specifically for email
          const { data, error } = await supabase
            .from('profiles')
            .select('email')
            .in('id', userIds);
            
          if (error) {
            console.error("Error fetching user emails:", error);
            return;
          }
          
          if (data && data.length > 0) {
            // Filter out any undefined emails and extract the email strings
            const emails = data
              .filter(profile => profile.email)
              .map(profile => profile.email)
              .filter(Boolean) as string[];
              
            setUserEmails(emails);
          }
        };
        
        fetchUserEmails();
      }
    } catch (error) {
      console.error("Error processing project users:", error);
      setUserEmails([]);
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
        user_emails: userEmails,
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
  
  const handleEmailsChange = (emails: string[]) => {
    setUserEmails(emails);
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
        <BasicInfoFields control={form.control} />
        
        <ProjectTypeStatusFields control={form.control} />
        
        <LocationField control={form.control} />
        
        <DateFields control={form.control} />
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Project Users (by Email)</label>
          <ProjectUserEmailInput
            onEmailsChange={handleEmailsChange}
            initialEmails={userEmails}
          />
          <p className="text-xs text-muted-foreground">
            Enter email addresses of users to invite to this project
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
