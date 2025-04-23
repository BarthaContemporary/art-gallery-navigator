
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";

interface DocumentActionsProps {
  onDownload: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function DocumentActions({ onDownload, onDelete, isDeleting }: DocumentActionsProps) {
  return (
    <div className="flex gap-2 mt-1 self-start">
      <Button
        variant="outline"
        size="icon"
        onClick={onDownload}
        aria-label="Download"
      >
        <Download className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onDelete}
        disabled={isDeleting}
        className="border-red-500 text-red-600 hover:bg-red-50"
        style={{
          borderColor: "#ea384c",
          color: "#ea384c",
        }}
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
