/**
 * Toolbar for bulk artwork operations
 */

import React from "react";
import { Check, X, Trash2, FolderPlus, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ArtworkSelectionToolbarProps {
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCreateCollection: () => void;
  onBulkDelete: () => void;
  onExitSelectionMode: () => void;
}

export function ArtworkSelectionToolbar({
  selectedCount,
  allSelected,
  someSelected,
  onSelectAll,
  onClearSelection,
  onCreateCollection,
  onBulkDelete,
  onExitSelectionMode,
}: ArtworkSelectionToolbarProps) {
  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExitSelectionMode}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-2" />
            Exit Selection
          </Button>
          
          <div className="h-6 w-px bg-border" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={allSelected ? onClearSelection : onSelectAll}
            className="text-muted-foreground hover:text-foreground"
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4 mr-2" />
            ) : (
              <Square className={cn("h-4 w-4 mr-2", someSelected && "text-primary")} />
            )}
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {selectedCount} selected
          </span>
        </div>
        
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCreateCollection}
              className="bg-background"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Create Collection
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              className="bg-background text-destructive hover:text-destructive-foreground hover:bg-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}