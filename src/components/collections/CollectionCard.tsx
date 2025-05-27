import { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Card } from "@/components/ui/card";
import { CollectionDetailsDialog } from "./CollectionDetailsDialog";
import { useAuth } from "@/hooks/use-auth";
import { CollectionCardContent } from "./CollectionCardContent";
import { CollectionCardAdminMenu } from "./CollectionCardAdminMenu";

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const { isAdmin } = useAuth();
  
  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow group relative"
        onClick={() => setShowDetailsDialog(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setShowDetailsDialog(true);
          }
        }}
        aria-label={`View details for collection ${collection.name}`}
      >
        {isAdmin && <CollectionCardAdminMenu collection={collection} />}
        <CollectionCardContent collection={collection} />
      </Card>
      
      <CollectionDetailsDialog
        collection={collection}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
      {/* EditCollectionDialog and DeleteCollectionDialog are now managed by CollectionCardAdminMenu */}
    </>
  );
}
