
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus } from "lucide-react";

interface UserSelectionPopoverTriggerProps {
  disabled: boolean;
  isAdding: boolean;
  queryError: boolean;
}

export function UserSelectionPopoverTrigger({
  disabled,
  isAdding,
  queryError,
}: UserSelectionPopoverTriggerProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="flex items-center gap-1 w-full justify-start"
      disabled={disabled || isAdding || queryError}
      title={queryError ? "Error loading users list" : "Add Team Member"}
    >
      {isAdding ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <UserPlus className="h-4 w-4 mr-2" />
      )}
      Add Team Member
    </Button>
  );
}
