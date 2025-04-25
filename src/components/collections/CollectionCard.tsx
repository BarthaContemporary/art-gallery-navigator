
import { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { CollectionDetailsDialog } from "./CollectionDetailsDialog";
import { EditCollectionDialog } from "./EditCollectionDialog";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteCollection } from "@/hooks/use-collections";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { mutate: deleteCollection, isPending: isDeleting } = useDeleteCollection();
  const { isAdmin } = useAuth();
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEdit(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteCollection(collection.id, {
      onSuccess: () => {
        toast.success("Collection deleted successfully");
        setShowDeleteConfirm(false);
      },
      onError: (error) => {
        toast.error("Failed to delete collection: " + error.message);
      },
    });
  };
  
  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow group relative"
        onClick={() => setShowDetails(true)}
      >
        <CardContent className="p-4">
          {isAdmin && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Actions for {collection.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <h2 className="font-semibold text-lg">{collection.name}</h2>
          {collection.description && (
            <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{collection.artworks?.length || 0}</span> {' '}
              {(collection.artworks?.length || 0) === 1 ? 'artwork' : 'artworks'}
            </div>
          </div>
        </CardContent>
      </Card>
      
      <CollectionDetailsDialog
        collection={collection}
        open={showDetails}
        onOpenChange={setShowDetails}
      />

      <EditCollectionDialog
        collection={collection}
        open={showEdit}
        onOpenChange={setShowEdit}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the collection "{collection.name}" and remove all artwork associations.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Collection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
