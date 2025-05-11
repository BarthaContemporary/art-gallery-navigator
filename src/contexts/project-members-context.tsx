
import { createContext, useContext, useCallback, ReactNode } from "react";
import { ProjectMember, MemberOperationResult, ProfileData, isProfileData } from "@/hooks/projects/types/member-types";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectMembersContextType {
  members: ProjectMember[];
  loading: boolean;
  error: string | null;
  addMember: (projectId: string, email: string) => Promise<MemberOperationResult>;
  removeMember: (projectId: string, userId: string) => Promise<MemberOperationResult>;
  loadMembers: (projectId: string) => Promise<ProjectMember[]>;
}

const ProjectMembersContext = createContext<ProjectMembersContextType | undefined>(undefined);

export function ProjectMembersProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async (projectId: string): Promise<ProjectMember[]> => {
    if (!projectId) {
      console.log("No projectId provided to loadMembers");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch project members with a properly typed query
      const { data: membersData, error: membersError } = await supabase
        .from('project_users')
        .select(`
          user_id,
          project_id,
          profiles:user_id (
            id,
            display_name,
            avatar_url,
            email_confirmed
          )
        `)
        .eq('project_id', projectId);

      if (membersError) {
        throw membersError;
      }

      // Transform the data into our consistent ProjectMember format
      const projectMembers: ProjectMember[] = membersData.map(item => {
        // Ensure profile exists and use safe property access
        const profileData = item.profiles || {};
        const profile: ProfileData = isProfileData(profileData) ? profileData : {};
        
        return {
          user_id: item.user_id,
          project_id: item.project_id,
          display_name: profile.display_name || 'Unknown User',
          avatar_url: profile.avatar_url || null,
          email: profile.display_name || null // Using display_name as email since that's what's stored
        };
      });

      setMembers(projectMembers);
      setLoading(false);
      return projectMembers;
    } catch (err: any) {
      console.error("Error in loadMembers:", err);
      setError(err.message || "Failed to load team members");
      setLoading(false);
      return [];
    }
  }, []);

  const addMember = useCallback(async (
    projectId: string, 
    email: string
  ): Promise<MemberOperationResult> => {
    if (!projectId || !email) {
      return {
        success: false,
        message: "Missing project ID or email"
      };
    }
    
    try {
      // First find the profile with this email (stored in display_name)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('display_name', email)
        .single();
      
      if (profileError || !profile) {
        return {
          success: false,
          message: `No user found with email: ${email}`
        };
      }
      
      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('project_users')
        .select('id')
        .eq('project_id', projectId)
        .eq('user_id', profile.id)
        .single();
        
      if (existingMember) {
        return {
          success: false,
          message: `User ${email} is already a member of this project`
        };
      }
      
      // Add the user to the project
      const { error: insertError } = await supabase
        .from('project_users')
        .insert({
          project_id: projectId,
          user_id: profile.id
        });
        
      if (insertError) {
        throw insertError;
      }
      
      // Create the member object with consistent formatting
      const newMember: ProjectMember = {
        user_id: profile.id,
        project_id: projectId,
        display_name: profile.display_name || email,
        avatar_url: profile.avatar_url,
        email: profile.display_name || null // Using display_name as email since that's what's stored
      };
      
      // Update the local state
      setMembers(prev => [...prev, newMember]);
      
      return {
        success: true,
        message: `Added ${email} to the project`,
        member: newMember
      };
    } catch (err: any) {
      console.error("Error adding project member:", err);
      return {
        success: false,
        message: err.message || "Failed to add member"
      };
    }
  }, []);

  const removeMember = useCallback(async (
    projectId: string,
    userId: string
  ): Promise<MemberOperationResult> => {
    if (!projectId || !userId) {
      return {
        success: false,
        message: "Missing project ID or user ID"
      };
    }
    
    try {
      const { error } = await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
        
      if (error) {
        throw error;
      }
      
      // Update local state
      setMembers(prev => prev.filter(member => member.user_id !== userId));
      
      return {
        success: true,
        message: "Member removed successfully"
      };
    } catch (err: any) {
      console.error("Error removing project member:", err);
      return {
        success: false,
        message: err.message || "Failed to remove member"
      };
    }
  }, []);

  return (
    <ProjectMembersContext.Provider
      value={{
        members,
        loading,
        error,
        addMember,
        removeMember,
        loadMembers
      }}
    >
      {children}
    </ProjectMembersContext.Provider>
  );
}

export function useProjectMembers() {
  const context = useContext(ProjectMembersContext);
  if (context === undefined) {
    throw new Error("useProjectMembers must be used within a ProjectMembersProvider");
  }
  return context;
}
