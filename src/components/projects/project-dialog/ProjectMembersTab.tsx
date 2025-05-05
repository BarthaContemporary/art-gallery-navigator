
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ProjectUserEmailInput } from "../ProjectUserEmailInput";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProjectWithLocation } from "@/hooks/projects";

interface ProjectMembersTabProps {
  project: ProjectWithLocation;
  onClose: () => void;
}

export function ProjectMembersTab({ project, onClose }: ProjectMembersTabProps) {
  return (
    <div className="space-y-6 py-4">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Project team members</h3>
        <UserMultiSelect 
          projectId={project.id} 
          onClose={onClose} 
        />
      </div>
    </div>
  );
}

// UserMultiSelect component for managing team members
function UserMultiSelect({ projectId, onClose }: { projectId: string, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { user, isAdmin } = useAuth();
  
  const handleSaveMembers = async () => {
    if (!projectId || emails.length === 0) {
      onClose();
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // First get existing profiles that match the entered emails/display names
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('display_name', emails);
      
      if (profilesError) {
        throw profilesError;
      }
      
      if (!profiles || profiles.length === 0) {
        toast.warning("No matching users found with the provided names");
        setLoading(false);
        return;
      }
      
      // Get existing project members to avoid duplicates
      const { data: existingMembers, error: membersError } = await supabase
        .from('project_users')
        .select('user_id')
        .eq('project_id', projectId);
      
      if (membersError) {
        console.error("Error checking existing members:", membersError);
        // Try a different approach if the first one fails due to permissions
        if (membersError.code === '42P17' || membersError.message.includes("permission")) {
          // Direct insert approach
          for (const profile of profiles) {
            try {
              const { error: insertError } = await supabase
                .from('project_users')
                .insert({
                  project_id: projectId,
                  user_id: profile.id
                });
                
              if (insertError && !insertError.message.includes("duplicate")) {
                console.error("Error inserting member:", insertError);
              }
            } catch (err) {
              console.error("Error in insert attempt:", err);
            }
          }
          
          // Force invalidate the project members query to update the list
          queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
          
          toast.success(`Attempted to add ${profiles.length} team member(s)`);
          onClose();
          return;
        }
        
        throw membersError;
      }
      
      const existingUserIds = existingMembers?.map(m => m.user_id) || [];
      
      // Filter out users that are already members
      const newMembers = profiles
        .filter(profile => !existingUserIds.includes(profile.id))
        .map(profile => ({
          project_id: projectId,
          user_id: profile.id
        }));
      
      if (newMembers.length === 0) {
        toast.info("All users are already members of this project");
        setLoading(false);
        return;
      }
      
      // Insert new members
      const { error: insertError } = await supabase
        .from('project_users')
        .insert(newMembers);
      
      if (insertError) {
        // If permission error, try one by one
        if (insertError.code === '42P17' || insertError.message.includes("permission")) {
          let successCount = 0;
          
          for (const member of newMembers) {
            try {
              const { error: singleInsertError } = await supabase
                .from('project_users')
                .insert(member);
                
              if (!singleInsertError) {
                successCount++;
              }
            } catch (err) {
              console.error("Error in single insert:", err);
            }
          }
          
          if (successCount > 0) {
            toast.success(`Added ${successCount} team member(s)`);
          } else {
            toast.error("Failed to add team members");
            throw new Error("Failed to add any team members");
          }
        } else {
          throw insertError;
        }
      } else {
        toast.success(`Added ${newMembers.length} team member${newMembers.length > 1 ? 's' : ''}`);
      }
      
      // Force invalidate the project members query to update the list
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      
      onClose();
    } catch (err: any) {
      console.error("Error saving team members:", err);
      setError(err.message || "Failed to add team members");
      toast.error("Failed to add team members");
    } finally {
      setLoading(false);
    }
  };
  
  const handleEmailsChange = (newEmails: string[]) => {
    setEmails(newEmails);
  };
  
  return (
    <div className="space-y-4">
      <ProjectUserEmailInput 
        projectId={projectId}
        onEmailsChange={handleEmailsChange}
      />
      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={handleSaveMembers}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : "Save Members"}
        </Button>
      </div>
      {error && (
        <div className="text-sm text-red-500 mt-2">{error}</div>
      )}
    </div>
  );
}
