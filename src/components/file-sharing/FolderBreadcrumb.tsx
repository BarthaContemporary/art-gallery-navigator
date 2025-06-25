
import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Folder {
  id: string;
  name: string;
  parent_folder_id: string | null;
}

interface FolderBreadcrumbProps {
  currentFolder: Folder | null;
  folders: Folder[];
  onNavigate: (folderId: string | null) => void;
}

export function FolderBreadcrumb({ currentFolder, folders, onNavigate }: FolderBreadcrumbProps) {
  const buildPath = (folder: Folder | null): Folder[] => {
    if (!folder) return [];
    
    const path: Folder[] = [folder];
    let current = folder;
    
    while (current.parent_folder_id) {
      const parent = folders.find(f => f.id === current.parent_folder_id);
      if (parent) {
        path.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }
    
    return path;
  };

  const path = buildPath(currentFolder);

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onNavigate(null)}
        className="h-auto p-1 text-muted-foreground hover:text-foreground"
      >
        <Home className="h-4 w-4" />
      </Button>
      
      {path.map((folder, index) => (
        <div key={folder.id} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(folder.id)}
            className={`h-auto p-1 ${
              index === path.length - 1 
                ? "text-foreground font-medium" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {folder.name}
          </Button>
        </div>
      ))}
    </nav>
  );
}
