
import { useParams, useNavigate } from "react-router-dom";
import { useProject } from "@/hooks/use-projects";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { ProjectDetailHeader } from "./ProjectDetailHeader";
import { ProjectTeamSection } from "./ProjectTeamSection";
import { ProjectTasksList } from "./ProjectTasksList";
import { ProjectDialogsManager } from "./ProjectDialogsManager";
import { useProjectMembers } from "@/hooks/use-projects";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { useProjectDialogs } from "./useProjectDialogs";
import { useAuth } from "@/hooks/use-auth";
import { DebugInfo } from "@/components/ui/debug-info";

const ProjectDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // Add member dialog state
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  
  // Add error handling for the data fetching hooks
  const { 
    data: project, 
    isLoading, 
    isError, 
    error: projectError 
  } = useProject(id);
  
  const { 
    data: projectMembers,
    isLoading: membersLoading,
    isError: membersError,
    error: membersErrorDetails,
    refetch: refetchMembers
  } = useProjectMembers(id);
  
  const { 
    data: projectTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorDetails
  } = useProjectTasks(id);
  
  // Force refresh project members when dialog closes
  useEffect(() => {
    if (!addMemberDialogOpen && id) {
      // A small delay to ensure any database operations have completed
      const timer = setTimeout(() => {
        refetchMembers();
        queryClient.invalidateQueries({ queryKey: ['project-members', id] });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [addMemberDialogOpen, id, refetchMembers, queryClient]);
  
  // Determine if user is a member - assume current user is a member if we can't determine
  const userIsMember = isAdmin || 
    (projectMembers?.some(member => member.user_id === user?.id)) || 
    Boolean(user); // Fallback - assume user is a member
  
  const debugData = {
    project,
    members: projectMembers,
    user: user?.id,
    isAdmin,
    userIsMember,
    errors: {
      members: membersErrorDetails,
      tasks: tasksErrorDetails
    }
  };
  
  if (isLoading) {
    return <div className="p-6 text-center">Loading project details...</div>;
  }
  
  if (isError || !project) {
    toast.error(`Failed to load project: ${projectError?.message || 'Unknown error'}`);
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">Failed to load project details.</div>
        <button 
          onClick={() => navigate("/projects")}
          className="px-4 py-2 bg-primary text-white rounded-md"
        >
          Return to Projects
        </button>
      </div>
    );
  }
  
  const handleAddMemberClick = () => {
    try {
      setAddMemberDialogOpen(true);
      // Pre-fetch members to ensure we have the latest data
      refetchMembers();
    } catch (error) {
      console.error("Error opening add member dialog:", error);
      toast.error("Failed to open add member dialog");
    }
  };
  
  // Force close the member dialog and refresh data
  const handleCloseMemberDialog = () => {
    setAddMemberDialogOpen(false);
    // Force refresh project members when dialog closes
    setTimeout(() => {
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ['project-members', id] });
    }, 300);
  };
  
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ProjectDetailHeader 
        project={project}
        userIsMember={userIsMember}
        isAdmin={isAdmin}
        onEditClick={() => projectDialogs.setEditDialogOpen(true)}
        onDeleteClick={() => projectDialogs.setDeleteDialogOpen(true, project, navigate)}
        onCalendarViewClick={() => projectDialogs.setCalendarViewOpen(true)}
      />
      
      <ProjectTeamSection 
        projectMembers={projectMembers || [{ 
          user_id: user?.id || 'unknown',
          project_id: id || 'unknown',
          display_name: user?.email || 'Current User', 
          avatar_url: null,
          email: user?.email
        }]}
        isLoading={membersLoading}
        isError={membersError}
        onAddMember={handleAddMemberClick}
        userIsMember={userIsMember}
        isAdmin={isAdmin}
      />
      
      <ProjectTasksList 
        tasks={projectTasks}
        isAdmin={isAdmin}
        userIsMember={userIsMember}
        onCreateTask={() => projectDialogs.setCreateTaskDialogOpen(true)}
        onEditTask={(task) => projectDialogs.openTaskEditDialog(task)}
        isLoading={tasksLoading}
        isError={tasksError}
      />
      
      {/* Project dialogs */}
      <ProjectDialogsManager
        project={project}
        dialogStates={{
          ...projectDialogs,
          addMemberDialogOpen,
          onCloseMemberDialog: handleCloseMemberDialog
        }}
        navigate={navigate}
      />
      
      {/* Add debug info - only shown in development */}
      <DebugInfo data={debugData} title="Project Debug Info" />
    </div>
  );
  
  const projectDialogs = useProjectDialogs();
};

export default ProjectDetailPage;
