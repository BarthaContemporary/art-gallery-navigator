import { useState, useCallback } from "react";
import { useDialog } from "@/hooks/use-dialog";
import { TaskWithAssignee, ProjectWithLocation } from "@/hooks/projects";
import { toast } from "sonner";

export function useProjectDialogs() {
  const [taskToEdit, setTaskToEdit] = useState<TaskWithAssignee | null>(null);
  
  const {
    isOpen: editDialogOpen,
    onOpenChange: setEditDialogOpenBase
  } = useDialog();

  const {
    isOpen: deleteDialogOpen,
    onOpenChange: setDeleteDialogOpenBase
  } = useDialog();
  
  const {
    isOpen: calendarViewOpen,
    onOpenChange: setCalendarViewOpenBase
  } = useDialog();
  
  const {
    isOpen: createTaskDialogOpen,
    onOpenChange: setCreateTaskDialogOpenBase
  } = useDialog();
  
  const {
    isOpen: editTaskDialogOpen,
    onOpenChange: handleEditTaskDialogChangeBase
  } = useDialog();
  
  // Wrap all dialog state handlers with try/catch and additional safety
  const setEditDialogOpen = useCallback((open: boolean) => {
    try {
      setEditDialogOpenBase(open);
    } catch (error) {
      console.error("Error changing edit dialog state:", error);
      toast.error("Failed to handle dialog interaction");
    }
  }, [setEditDialogOpenBase]);
  
  const handleDeleteDialogChange = useCallback((
    open: boolean, 
    project: ProjectWithLocation | null = null, 
    navigate?: (path: string) => void
  ) => {
    try {
      setDeleteDialogOpenBase(open);
      if (!open && !project && navigate) {
        // This condition seems to imply navigating away if dialog closes AND project is null.
        // Usually, navigation after delete happens in the delete mutation's onSuccess.
        // Keeping as is for now, but it might need review based on desired UX.
        // If project is null when closing, it means deletion might have happened.
         if (navigate) navigate("/projects");
      }
    } catch (error) {
      console.error("Error changing delete dialog state:", error);
      toast.error("Failed to handle dialog interaction");
      if (!open && navigate) {
        // Fallback navigation on error during close
        navigate("/projects");
      }
    }
  }, [setDeleteDialogOpenBase]);
  
  const setCalendarViewOpen = useCallback((open: boolean) => {
    try {
      setCalendarViewOpenBase(open);
    } catch (error) {
      console.error("Error changing calendar dialog state:", error);
      toast.error("Failed to handle dialog interaction");
    }
  }, [setCalendarViewOpenBase]);
  
  const setCreateTaskDialogOpen = useCallback((open: boolean) => {
    try {
      setCreateTaskDialogOpenBase(open);
    } catch (error) {
      console.error("Error changing create task dialog state:", error);
      toast.error("Failed to handle dialog interaction");
    }
  }, [setCreateTaskDialogOpenBase]);
  
  const setEditTaskDialogOpen = useCallback((open: boolean) => {
    try {
      handleEditTaskDialogChangeBase(open);
      if (!open) {
        setTimeout(() => {
          setTaskToEdit(null);
        }, 300); // Clear after dialog animation
      }
    } catch (error) {
      console.error("Error changing edit task dialog state:", error);
      toast.error("Failed to handle dialog interaction");
      setTaskToEdit(null); // Clear immediately on error
    }
  }, [handleEditTaskDialogChangeBase]);
  
  const openTaskEditDialog = useCallback((task: TaskWithAssignee) => {
    try {
      setTaskToEdit(task);
      setEditTaskDialogOpen(true); // This will call the wrapped setEditTaskDialogOpen
    } catch (error) {
      console.error("Error opening task edit dialog:", error);
      toast.error("Failed to open task edit dialog");
    }
  }, [setEditTaskDialogOpen]); // Depends on the wrapped setter
  
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
    setEditTaskDialogOpen, // Return the wrapped setter
    openTaskEditDialog
  };
}
