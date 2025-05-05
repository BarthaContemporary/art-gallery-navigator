
import { useParams } from "react-router-dom";
import { useProject, useProjectMembers } from "@/hooks/use-projects";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { useAuth } from "@/hooks/use-auth";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView";
import { ProjectTaskDialog } from "@/components/projects/ProjectTaskDialog";

import { ProjectDetailHeader } from "@/components/projects/detail/ProjectDetailHeader";
import { ProjectTeamSection } from "@/components/projects/detail/ProjectTeamSection";
import { ProjectTasksList } from "@/components/projects/detail/ProjectTasksList";
import { useProjectDialogs } from "@/components/projects/detail/useProjectDialogs";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { data: project, isLoading, isError } = useProject(id);
  const { data: projectMembers } = useProjectMembers(id);
  const { data: projectTasks } = useProjectTasks(id);
  
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
  
  const userIsMember = projectMembers?.some(member => member.user_id === user?.id);
  
  if (isLoading) {
    return <div className="p-6 text-center">Loading project details...</div>;
  }
  
  if (isError || !project) {
    return <div className="p-6 text-center text-red-500">Failed to load project details.</div>;
  }
  
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <ProjectDetailHeader 
        project={project}
        userIsMember={userIsMember || false}
        isAdmin={isAdmin}
        onEditClick={() => setEditDialogOpen(true)}
        onDeleteClick={() => setDeleteDialogOpen(true)}
        onCalendarViewClick={() => setCalendarViewOpen(true)}
      />
      
      <ProjectTeamSection projectMembers={projectMembers} />
      
      <ProjectTasksList 
        tasks={projectTasks}
        isAdmin={isAdmin}
        userIsMember={userIsMember || false}
        onCreateTask={() => setCreateTaskDialogOpen(true)}
        onEditTask={openTaskEditDialog}
      />
      
      {/* Dialogs */}
      <ProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={project}
      />
      
      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => setDeleteDialogOpen(open, project)}
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
