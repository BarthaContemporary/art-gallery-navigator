
import { Edit, Copy, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ArtworkCardActionsProps {
  onEdit: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  onDelete: () => void;
}

export function ArtworkCardActions({ 
  onEdit, 
  onDuplicate, 
  onExport, 
  onDelete 
}: ArtworkCardActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          size="icon" 
          variant="ghost" 
          className="h-8 w-8 bg-white/80 hover:bg-white shadow-sm z-10"
          tabIndex={0}
          aria-label="Artwork actions"
          onClick={e => e.stopPropagation()}
        >
          <Edit className="h-4 w-4" />
          <span className="sr-only">Artwork actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white z-[100]" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={onDelete}
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
