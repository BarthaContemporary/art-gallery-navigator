
import { UserPlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AddMemberInputProps {
  emailInput: string;
  onEmailChange: (value: string) => void;
  onAddMember: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  loading: boolean;
}

export function AddMemberInput({
  emailInput,
  onEmailChange,
  onAddMember,
  onKeyDown,
  loading
}: AddMemberInputProps) {
  return (
    <div className="flex gap-2">
      <Input
        value={emailInput}
        onChange={e => onEmailChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Enter email address"
        disabled={loading}
        className="flex-1"
      />
      <Button 
        type="button"
        size="sm"
        variant="outline"
        onClick={onAddMember}
        disabled={!emailInput.trim() || loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-1" />
            <span>Add</span>
          </>
        )}
      </Button>
    </div>
  );
}
