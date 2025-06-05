
import { ViewToggle, ViewMode } from "@/components/ui/view-toggle";

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
    <ViewToggle 
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      className={className}
    />
  );
}

export type { ViewMode };
