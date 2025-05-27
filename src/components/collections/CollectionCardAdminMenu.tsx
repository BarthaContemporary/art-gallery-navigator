
import React, { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, MoreVertical, Link as LinkIcon } from "lucide-react";
import { EditCollectionDialog } from "./EditCollectionDialog";
import { DeleteCollectionDialog } from "./DeleteCollectionDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface CollectionCardAdminMenuProps {
  collection: Collection;
}

export function CollectionCardAdminMenu({ collection }: CollectionCardAdminMenuProps) {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // const [showManageWebsitesDialog, setShowManageWebsitesDialog] = useState(false); // Placeholder

  const preventPropagation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEditClick = (e: React.MouseEvent) => {
    preventPropagation(e);
    setShowEditDialog(true);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    preventPropagation(e);
    setShowDeleteDialog(true);
  };

  const handleManageWebsitesClick = (e: React.MouseEvent) => {
    preventPropagation(e);
    toast.info(`Manage shareable websites for "${collection.name}" (dialog coming soon).`);
    // setShowManageWebsitesDialog(true);
  };

  return (
    <>
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={preventPropagation}
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions for {collection.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={preventPropagation}>
            <DropdownMenuItem onClick={handleManageWebsitesClick}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Shareable Websites
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleEditClick}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <EditCollectionDialog
        collection={collection}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <DeleteCollectionDialog
        collection={collection}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
      
      {/* Placeholder for ShareableWebsiteDialog - to be implemented later
      {showManageWebsitesDialog && (
        <ShareableWebsiteDialog
          collection={collection}
          open={showManageWebsitesDialog}
          onOpenChange={setShowManageWebsitesDialog}
        />
      )}
      */}
    </>
  );
}
