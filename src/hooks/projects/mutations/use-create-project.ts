
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { CreateProjectInput } from "../types/project-types";

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { user_emails, ...projectData } = input;
      
      try {
        // Get current user first to avoid auth issues
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          throw new Error(`Authentication error: ${userError.message}`);
        }
        
        if (!userData?.user?.id) {
          throw new Error("No current user found, authentication may be required");
        }
        
        const currentUserId = userData.user.id;
        
        // First create the project
        const { data: project, error: projectError } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single();
        
        if (projectError) {
          console.error("Error creating project:", projectError);
          throw new Error(`Failed to create project: ${projectError.message}`);
        }
        
        if (!project) {
          throw new Error("Project was not created, no data returned");
        }
        
        // Add the current user as a member using a separate call
        const { error: memberError } = await supabase
          .from('project_users')
          .insert({
            project_id: project.id,
            user_id: currentUserId
          });
        
        if (memberError) {
          console.error("Error adding current user to project:", memberError);
          // Continue with trying to add other users
        }
        
        // Skip other users if none specified
        if (!user_emails || user_emails.length === 0) {
          return project;
        }
        
        // Process each email individually to handle potential errors gracefully
        const notFoundEmails: string[] = [];
        const addedEmails: string[] = [];
        
        for (const email of user_emails) {
          if (!email.trim()) continue;
          
          try {
            // Find user by email (display_name in profiles)
            const { data: profiles, error: findError } = await supabase
              .from('profiles')
              .select('id')
              .eq('display_name', email.trim())
              .limit(1);
            
            if (findError) {
              console.error(`Error finding user with email ${email}:`, findError);
              continue;
            }
            
            if (!profiles || profiles.length === 0) {
              notFoundEmails.push(email);
              continue;
            }
            
            const userId = profiles[0].id;
            
            // Skip adding current user again
            if (userId === currentUserId) continue;
            
            // Add user to project
            const { error: insertError } = await supabase
              .from('project_users')
              .insert({
                project_id: project.id,
                user_id: userId
              });
            
            if (insertError) {
              if (insertError.message.includes('duplicate')) {
                // User already added, just note it
                addedEmails.push(email);
              } else {
                console.error(`Error adding user ${email} to project:`, insertError);
              }
            } else {
              addedEmails.push(email);
            }
          } catch (err) {
            console.error(`Error processing user ${email}:`, err);
          }
        }
        
        if (notFoundEmails.length > 0) {
          toast.warning(`Some users could not be found: ${notFoundEmails.join(', ')}`);
        }
        
        if (addedEmails.length > 0) {
          toast.success(`Added team members: ${addedEmails.join(', ')}`);
        }
        
        return project;
      } catch (error) {
        console.error("Project creation failed:", error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Project created successfully");
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: any) => {
      console.error("Error in create project mutation:", error);
      const errorMessage = error?.message || "Failed to create project";
      toast.error(errorMessage);
    }
  });
}
