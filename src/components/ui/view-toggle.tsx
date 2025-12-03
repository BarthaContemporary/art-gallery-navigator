
import { Button } from "@/components/ui/button";
import { Grid3X3, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = 'grid' | 'list';

interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ 
  viewMode, 
  onViewModeChange, 
  className 
}: ViewToggleProps) {
  return (
    <div className={cn("flex items-center border p-0.5 bg-muted", className)}>
      <Button
        variant={viewMode === 'grid' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('grid')}
        className="h-7 px-2 text-xs flex items-center justify-center"
      >
        <Grid3X3 className="h-3 w-3" />
      </Button>
      
      <Button
        variant={viewMode === 'list' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onViewModeChange('list')}
        className="h-7 px-2 text-xs flex items-center justify-center"
      >
        <List className="h-3 w-3" />
      </Button>
    </div>
  );
}
