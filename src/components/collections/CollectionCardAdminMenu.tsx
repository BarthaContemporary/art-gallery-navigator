
import React from "react";
import { Collection } from "@/hooks/use-collections";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Link as LinkIcon } from "lucide-react";
import { EditCollectionDialog } from "./EditCollectionDialog";
import { DeleteCollectionDialog } from "./DeleteCollectionDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useCollectionCardAdminMenuLogic } from "./hooks/useCollectionCardAdminMenuLogic";

interface CollectionCardAdminMenuProps {
  collection: Collection;
}

export function CollectionCardAdminMenu({ collection }: CollectionCardAdminMenuProps) {
  const {
    showEditDialog,
    setShowEditDialog,
    showDeleteDialog,
    setShowDeleteDialog,
    preventPropagation,
    handleEditClick,
    handleDeleteClick,
    handleManageWebsitesClick,
  } = useCollectionCardAdminMenuLogic({ collection });

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
              <Edit className="h-4 w-4" />
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
    </>
  );
}
