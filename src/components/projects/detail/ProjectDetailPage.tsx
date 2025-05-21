
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";

import { 
  useProject, 
  useProjectMembers, 
  useProjectTasks,
  ProjectWithLocation, // Ensure type is imported
  TaskWithAssignee // Ensure type is imported
} from "@/hooks/projects"; // Standardized import path

import { ProjectDetailHeader } from "./ProjectDetailHeader";
import { ProjectTeamSection } from "./ProjectTeamSection";
import { ProjectTasksList } from "./ProjectTasksList";
import { ProjectDialogsManager } from "./ProjectDialogsManager";
import { useProjectDialogs } from "./useProjectDialogs";
import { useAuth } from "@/hooks/use-auth";
import { DebugInfo } from "@/components/ui/debug-info";

const ProjectDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const projectDialogs = useProjectDialogs();
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  
  const { 
    data: project, 
    isLoading, 
    isError, 
    error: projectError 
  } = useProject(id);
  
  const { 
    members, 
    isLoading: membersLoading, 
    isError: membersError,
    error: membersErrorDetails
  } = useProjectMembers(id);
  
  const { 
    data: projectTasks,
    isLoading: tasksLoading,
    isError: tasksError,
    error: tasksErrorDetails
  } = useProjectTasks(id);
  
  useEffect(() => {
    if (membersError) {
      console.error("Members error:", membersErrorDetails);
    }
    if (tasksError) {
      console.error("Tasks error:", tasksErrorDetails);
    }
  }, [membersError, membersErrorDetails, tasksError, tasksErrorDetails]);
  
  // Refined userIsMember logic
  const actualUserIsMember = isAdmin || (members?.some(member => member.user_id === user?.id) ?? false);
  
  const debugData = {
    project,
    members,
    memberCount: members?.length || 0,
    user: user?.id,
    isAdmin,
    userIsMember: actualUserIsMember, // Use refined logic for debug
    membersError: membersError ? 'Error loading members' : null,
    tasksError: tasksError ? 'Error loading tasks' : null,
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
    } catch (error) {
      console.error("Error opening add member dialog:", error);
      toast.error("Failed to open add member dialog");
    }
  };
  
  const handleCloseMemberDialog = () => {
    setAddMemberDialogOpen(false);
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['project-members', id] });
    }, 300);
  };
  
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ProjectDetailHeader 
        project={project}
        userIsMember={actualUserIsMember} // Pass refined logic
        isAdmin={isAdmin}
        onEditClick={() => projectDialogs.setEditDialogOpen(true)}
        onDeleteClick={() => projectDialogs.setDeleteDialogOpen(true, project, navigate)}
        onCalendarViewClick={() => projectDialogs.setCalendarViewOpen(true)}
      />
      
      <ProjectTeamSection 
        projectId={id}
        onAddMember={handleAddMemberClick}
        userIsMember={actualUserIsMember} // Pass refined logic
        isAdmin={isAdmin}
      />
      
      <ProjectTasksList 
        tasks={projectTasks}
        isAdmin={isAdmin}
        userIsMember={actualUserIsMember} // Pass refined logic
        onCreateTask={() => projectDialogs.setCreateTaskDialogOpen(true)}
        onEditTask={(task) => projectDialogs.openTaskEditDialog(task)}
        isLoading={tasksLoading}
        isError={tasksError}
      />
      
      <ProjectDialogsManager
        project={project}
        dialogStates={{
          ...projectDialogs,
          addMemberDialogOpen,
          onCloseMemberDialog: handleCloseMemberDialog
        }}
        navigate={navigate}
      />
      
      <DebugInfo data={debugData} title="Project Debug Info" />
    </div>
  );
};

export default ProjectDetailPage;
