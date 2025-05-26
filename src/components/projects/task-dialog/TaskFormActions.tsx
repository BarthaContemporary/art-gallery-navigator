
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
        size="sm"
        className="text-xs md:text-sm"
      >
        Cancel
      </Button>
      <Button 
        type="submit" 
        disabled={isSubmitting}
        size="sm"
        className="text-xs md:text-sm"
      >
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
