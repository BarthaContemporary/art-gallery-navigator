
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
      <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 bg-background/80 backdrop-blur-sm border shadow-sm hover:bg-background hover:shadow-md transition-all duration-200"
              onClick={preventPropagation}
            >
              <Edit className="h-4 w-4" />
              <span className="sr-only">Actions for {collection.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={preventPropagation} className="w-48">
            <DropdownMenuItem onClick={handleManageWebsitesClick} className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Shareable Websites
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleEditClick} className="gap-2">
              <Edit className="h-4 w-4" />
              Edit Collection
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDeleteClick}
              className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete Collection
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
