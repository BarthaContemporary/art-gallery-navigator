
import { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { CollectionDetailsDialog } from "./CollectionDetailsDialog";

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Edit functionality will be implemented later
    console.log("Edit collection:", collection.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Delete functionality will be implemented later
    console.log("Delete collection:", collection.id);
  };
  
  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow group relative"
        onClick={() => setShowDetails(true)}
      >
        <CardContent className="p-4">
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleEdit}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
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
    </>
  );
}
