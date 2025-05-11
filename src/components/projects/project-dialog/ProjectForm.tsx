import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { format } from "date-fns";
import { ProjectWithLocation } from "@/hooks/projects";
import { ProjectFormSchema } from "./schema";
import { BasicInfoFields } from "./BasicInfoFields";
import { ProjectTypeStatusFields } from "./ProjectTypeStatusFields";
import { LocationField } from "./LocationField";
import { DateFields } from "./DateFields";
import { TeamMembersField } from "./TeamMembersField";
import { useProjectFormSubmit } from "./ProjectFormSubmit";
import * as z from "zod";

type FormValues = z.infer<typeof ProjectFormSchema>;

interface ProjectFormProps {
  project?: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const { onSubmit, isSubmitting, formError } = useProjectFormSubmit(project, onClose);
  
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
  
  const handleUserEmailsChange = useCallback((emails: string[]) => {
    setUserEmails(emails);
  }, []);
  
  const handleFormSubmit = form.handleSubmit((values) => {
    onSubmit(values, userEmails);
  });
  
  return (
    <Form {...form}>
      <form onSubmit={handleFormSubmit} className="space-y-4 py-4">
        <BasicInfoFields control={form.control} />
        
        <ProjectTypeStatusFields control={form.control} />
        
        <LocationField control={form.control} />
        
        <DateFields control={form.control} />
        
        <TeamMembersField 
          project={project} 
          onUserEmailsChange={handleUserEmailsChange} 
        />
        
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
