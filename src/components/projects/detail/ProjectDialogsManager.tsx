
import { ProjectDialog } from "@/components/projects/project-dialog/ProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView";
import { ProjectTaskDialog } from "@/components/projects/ProjectTaskDialog";
import { ProjectWithLocation, TaskWithAssignee } from "@/hooks/projects"; // Standardized import
import { NavigateFunction } from "react-router-dom";

interface ProjectDialogsManagerProps {
  project: ProjectWithLocation;
  dialogStates: {
    taskToEdit: TaskWithAssignee | null;
    editDialogOpen: boolean;
    setEditDialogOpen: (open: boolean) => void;
    deleteDialogOpen: boolean;
    setDeleteDialogOpen: (open: boolean, project: ProjectWithLocation | null, navigate?: NavigateFunction) => void;
    calendarViewOpen: boolean;
    setCalendarViewOpen: (open: boolean) => void;
    createTaskDialogOpen: boolean;
    setCreateTaskDialogOpen: (open: boolean) => void;
    editTaskDialogOpen: boolean;
    setEditTaskDialogOpen: (open: boolean) => void;
    addMemberDialogOpen: boolean;
    onCloseMemberDialog: () => void;
    openTaskEditDialog: (task: TaskWithAssignee) => void; // Added this line
  };
  navigate: NavigateFunction;
}

export function ProjectDialogsManager({ 
  project, 
  dialogStates, 
  navigate 
}: ProjectDialogsManagerProps) {
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
    addMemberDialogOpen,
    onCloseMemberDialog,
    openTaskEditDialog // Destructure the new function
  } = dialogStates;

  return (
    <>
      <ProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={project}
      />
      
      <DeleteProjectDialog
        open={deleteDialogOpen}
        // Pass navigate to onOpenChange for DeleteProjectDialog if it needs it for redirection
        // The setDeleteDialogOpen in useProjectDialogs already handles navigate
        onOpenChange={(open) => setDeleteDialogOpen(open, project, navigate)}
        project={project}
      />
      
      <ProjectCalendarView 
        open={calendarViewOpen}
        onOpenChange={setCalendarViewOpen}
        project={project}
        onTaskClick={openTaskEditDialog} // Pass it to ProjectCalendarView
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
      
      {/* Add Member Dialog - Using initialTab="members" to directly open the members tab */}
      <ProjectDialog
        open={addMemberDialogOpen}
        onOpenChange={onCloseMemberDialog} // This is correct for this specific dialog instance
        project={project}
        initialTab="members"
      />
    </>
  );
}

