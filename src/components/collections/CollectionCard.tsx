
import { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Card, CardContent } from "@/components/ui/card";
import { CollectionDetailsDialog } from "./CollectionDetailsDialog";

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setShowDetails(true)}
      >
        <CardContent className="p-4">
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
