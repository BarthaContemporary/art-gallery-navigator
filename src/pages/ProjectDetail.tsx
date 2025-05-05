
import { useParams, useNavigate } from "react-router-dom";
import { useProject, useProjectMembers } from "@/hooks/use-projects";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { useAuth } from "@/hooks/use-auth";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView";
import { ProjectTaskDialog } from "@/components/projects/ProjectTaskDialog";
import { useCallback } from "react";
import { toast } from "sonner";

import { ProjectDetailHeader } from "@/components/projects/detail/ProjectDetailHeader";
import { ProjectTeamSection } from "@/components/projects/detail/ProjectTeamSection";
import { ProjectTasksList } from "@/components/projects/detail/ProjectTasksList";
import { useProjectDialogs } from "@/components/projects/detail/useProjectDialogs";

const ProjectDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  
  // Add error handling for the data fetching hooks
  const { 
    data: project, 
    isLoading, 
    isError, 
    error: projectError 
  } = useProject(id);
  
  const { 
    data: projectMembers,
    isError: membersError,
    error: membersErrorDetails 
  } = useProjectMembers(id);
  
  const { 
    data: projectTasks,
    isError: tasksError,
    error: tasksErrorDetails
  } = useProjectTasks(id);
  
  // Log errors for debugging
  if (membersError) {
    console.error("Error loading project members:", membersErrorDetails);
  }
  
  if (tasksError) {
    console.error("Error loading project tasks:", tasksErrorDetails);
  }
  
  const {
    taskToEdit,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen,
    calendarViewOpen,
    setCalendarViewOpen,
    createTaskDialogOpen,
    setCreateTaskDialogOpen,
    editTaskDialogOpen,
    setEditTaskDialogOpen,
    openTaskEditDialog
  } = useProjectDialogs();
  
  // Determine if user is a member with memoization for better performance
  const userIsMember = useCallback(() => {
    return projectMembers?.some(member => member.user_id === user?.id) || false;
  }, [projectMembers, user?.id]);
  
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
  
  // Wrap the dialog opening handlers to ensure they don't cause freezes
  const handleEditClick = () => {
    try {
      setEditDialogOpen(true);
    } catch (error) {
      console.error("Error opening edit dialog:", error);
      toast.error("Failed to open edit dialog");
    }
  };
  
  const handleDeleteClick = () => {
    try {
      setDeleteDialogOpen(true, project, navigate);
    } catch (error) {
      console.error("Error opening delete dialog:", error);
      toast.error("Failed to open delete dialog");
    }
  };
  
  const handleCalendarViewClick = () => {
    try {
      setCalendarViewOpen(true);
    } catch (error) {
      console.error("Error opening calendar view:", error);
      toast.error("Failed to open calendar view");
    }
  };
  
  const handleCreateTaskClick = () => {
    try {
      setCreateTaskDialogOpen(true);
    } catch (error) {
      console.error("Error opening task dialog:", error);
      toast.error("Failed to open task creation dialog");
    }
  };
  
  const handleEditTaskClick = (task: any) => {
    try {
      openTaskEditDialog(task);
    } catch (error) {
      console.error("Error opening task edit dialog:", error);
      toast.error("Failed to open task edit dialog");
    }
  };
  
  const isMember = userIsMember();
  
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ProjectDetailHeader 
        project={project}
        userIsMember={isMember}
        isAdmin={isAdmin}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
        onCalendarViewClick={handleCalendarViewClick}
      />
      
      <ProjectTeamSection projectMembers={projectMembers} />
      
      <ProjectTasksList 
        tasks={projectTasks}
        isAdmin={isAdmin}
        userIsMember={isMember}
        onCreateTask={handleCreateTaskClick}
        onEditTask={handleEditTaskClick}
      />
      
      {/* Dialogs */}
      <ProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={project}
      />
      
      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => setDeleteDialogOpen(open, project, navigate)}
        project={project}
      />
      
      <ProjectCalendarView 
        open={calendarViewOpen}
        onOpenChange={setCalendarViewOpen}
        project={project}
      />
      
      <ProjectTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={setCreateTaskDialogOpen}
        projectId={project.id}
      />
      
      {taskToEdit && (
        <ProjectTaskDialog
          open={editTaskDialogOpen}
          onOpenChange={setEditTaskDialogOpen}
          projectId={project.id}
          task={taskToEdit}
        />
      )}
    </div>
  );
};

export default ProjectDetail;
