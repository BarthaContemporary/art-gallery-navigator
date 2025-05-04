
import { MoreHorizontal, Edit, Trash2, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ProjectWithLocation } from "@/hooks/use-projects";
import { useAuth } from "@/hooks/use-auth";

interface ProjectCardActionsProps {
  project: ProjectWithLocation;
  onEdit?: (project: ProjectWithLocation) => void;
  onDelete?: (project: ProjectWithLocation) => void;
  onCalendar?: (project: ProjectWithLocation) => void;
}

export function ProjectCardActions({ project, onEdit, onDelete, onCalendar }: ProjectCardActionsProps) {
  const { isAdmin } = useAuth();

  return (
    <div className="absolute right-2 top-2 z-10" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onCalendar && (
            <DropdownMenuItem onClick={() => onCalendar(project)}>
              <Calendar className="mr-2 h-4 w-4" />
              Calendar View
            </DropdownMenuItem>
          )}
          {onEdit && (
            <DropdownMenuItem onClick={() => onEdit(project)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem
              onClick={() => onDelete(project)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
