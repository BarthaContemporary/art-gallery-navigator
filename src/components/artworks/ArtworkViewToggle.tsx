
import { Button } from "@/components/ui/button";
import { Grid3X3, List, Table } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = 'grid' | 'list' | 'table';

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
    <div className={cn("flex items-center border rounded-lg p-1", className)}>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('grid')}
        className="px-3"
      >
        <Grid3X3 className="h-4 w-4" />
        <span className="hidden sm:inline ml-2">Grid</span>
      </Button>
      
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('list')}
        className="px-3"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline ml-2">List</span>
      </Button>
      
      <Button
        variant={viewMode === 'table' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('table')}
        className="px-3"
      >
        <Table className="h-4 w-4" />
        <span className="hidden sm:inline ml-2">Table</span>
      </Button>
    </div>
  );
}
