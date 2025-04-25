
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface PDFPreviewFooterProps {
  type: "artwork" | "collection";
  onOpenChange: (open: boolean) => void;
  handleApply: () => void;
}

export function PDFPreviewFooter({ type, onOpenChange, handleApply }: PDFPreviewFooterProps) {
  return (
    <>
      {type === "artwork" && (
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Save and Generate PDF
          </Button>
        </div>
      )}
      
      {type === "collection" && (
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      )}
    </>
  );
}
