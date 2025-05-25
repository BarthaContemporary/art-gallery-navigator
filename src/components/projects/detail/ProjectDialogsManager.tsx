
import { ProjectDialog } from "@/components/projects/project-dialog/ProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { ProjectCalendarView } from "@/components/projects/ProjectCalendarView";
import { ProjectTaskDialog } from "@/components/projects/ProjectTaskDialog";
import { ProjectWithLocation, TaskWithAssignee } from "@/hooks/projects";
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
    addMemberDialogOpen: boolean; // This controls the dialog for adding members, which is now removed.
    onCloseMemberDialog: () => void; // Handler for the removed dialog.
    openTaskEditDialog: (task: TaskWithAssignee) => void;
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
    addMemberDialogOpen, // This prop is now vestigial.
    onCloseMemberDialog, // This prop is now vestigial.
    openTaskEditDialog
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
        onOpenChange={(open) => setDeleteDialogOpen(open, project, navigate)}
        project={project}
      />
      
      <ProjectCalendarView 
        open={calendarViewOpen}
        onOpenChange={setCalendarViewOpen}
        project={project}
        onTaskClick={openTaskEditDialog}
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
      
      {/* The "Add Member" Dialog is now fully removed.
          The ProjectDialog instance below was intended for adding members.
          Since the functionality is removed, this dialog instance is no longer needed.
          We will comment it out or remove it entirely.
          For now, let's remove it.
      */}
      {/* 
      <ProjectDialog
        open={addMemberDialogOpen} // This state might be removed from parent as well
        onOpenChange={onCloseMemberDialog} // This handler might be removed from parent
        project={project}
        // initialTab="members" // Removed: initialTab prop
      />
      */}
    </>
  );
}
