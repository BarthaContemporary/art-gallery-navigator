
import { Button } from "@/components/ui/button";
import { Grid3X3, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = 'grid' | 'list';

interface ArtworkViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function ArtworkViewToggle({ 
  viewMode, 
  onViewModeChange, 
  className 
}: ArtworkViewToggleProps) {
  return (
    <div className={cn("flex items-center border rounded-md p-0.5", className)}>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('grid')}
        className="h-7 px-2 text-xs"
      >
        <Grid3X3 className="h-3 w-3" />
        <span className="hidden sm:inline ml-1">Grid</span>
      </Button>
      
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('list')}
        className="h-7 px-2 text-xs"
      >
        <List className="h-3 w-3" />
        <span className="hidden sm:inline ml-1">List</span>
      </Button>
    </div>
  );
}
