import { useState } from "react";
import { useDialog } from "@/hooks/use-dialog";
import { TaskWithAssignee, ProjectWithLocation } from "@/hooks/projects";

export function useProjectDialogs() {
  const [taskToEdit, setTaskToEdit] = useState<TaskWithAssignee | null>(null);
  
  const {
    isOpen: editDialogOpen,
    onOpenChange: setEditDialogOpen
  } = useDialog();

  const {
    isOpen: deleteDialogOpen,
    onOpenChange: setDeleteDialogOpen
  } = useDialog();
  
  const {
    isOpen: calendarViewOpen,
    onOpenChange: setCalendarViewOpen
  } = useDialog();
  
  const {
    isOpen: createTaskDialogOpen,
    onOpenChange: setCreateTaskDialogOpen
  } = useDialog();
  
  const {
    isOpen: editTaskDialogOpen,
    onOpenChange: handleEditTaskDialogChange
  } = useDialog();
  
  const setEditTaskDialogOpen = (open: boolean) => {
    handleEditTaskDialogChange(open);
    if (!open) setTaskToEdit(null);
  };
  
  const openTaskEditDialog = (task: TaskWithAssignee) => {
    setTaskToEdit(task);
    setEditTaskDialogOpen(true);
  };
  
  const handleDeleteDialogChange = (open: boolean, project: ProjectWithLocation | null = null, navigate?: (path: string) => void) => {
    setDeleteDialogOpen(open);
    if (!open && !project && navigate) navigate("/projects");
  };
  
  return {
    taskToEdit,
    editDialogOpen,
    setEditDialogOpen,
    deleteDialogOpen,
    setDeleteDialogOpen: handleDeleteDialogChange,
    calendarViewOpen,
    setCalendarViewOpen,
    createTaskDialogOpen,
    setCreateTaskDialogOpen,
    editTaskDialogOpen,
    setEditTaskDialogOpen,
    openTaskEditDialog
  };
}
