
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface TaskFormActionsProps {
  isSubmitting: boolean;
  onCancel: () => void;
  isEditing: boolean;
}

export function TaskFormActions({ isSubmitting, onCancel, isEditing }: TaskFormActionsProps) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? isEditing
            ? "Updating..."
            : "Creating..."
          : isEditing
          ? "Update Task"
          : "Create Task"}
      </Button>
    </DialogFooter>
  );
}
