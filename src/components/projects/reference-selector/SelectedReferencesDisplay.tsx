
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Reference } from "./types";

interface SelectedReferencesDisplayProps {
  selectedReferences: Reference[];
  onRemoveReference: (ref: Reference) => void;
}

export function SelectedReferencesDisplay({ selectedReferences, onRemoveReference }: SelectedReferencesDisplayProps) {
  if (selectedReferences.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {selectedReferences.map(ref => (
        <Badge key={`${ref.type}-${ref.id}`} variant="secondary" className="flex items-center gap-1">
          <span className="capitalize">{ref.type}</span>: {ref.name}
          <X 
            className="h-3 w-3 cursor-pointer hover:text-destructive" 
            onClick={() => onRemoveReference(ref)}
          />
        </Badge>
      ))}
    </div>
  );
}
