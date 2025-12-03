
import { useState } from "react";
import { Collection } from "@/hooks/use-collections";
import { Card } from "@/components/ui/card";
import { CollectionDetailsDialog } from "./CollectionDetailsDialog";
import { useAuth } from "@/hooks/use-auth";
import { CollectionCardContent } from "./CollectionCardContent";
import { CollectionCardAdminMenu } from "./CollectionCardAdminMenu";

interface CollectionCardProps {
  collection: Collection;
  showArtistName?: boolean;
}

export function CollectionCard({ collection, showArtistName = false }: CollectionCardProps) {
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const { isAdmin } = useAuth();
  
  return (
    <>
      <Card 
        className="cursor-pointer border bg-card hover:shadow-md transition-all duration-200 group relative overflow-hidden animate-fade-in"
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
        <CollectionCardContent collection={collection} showArtistName={showArtistName} />
      </Card>
      
      <CollectionDetailsDialog
        collection={collection}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
    </>
  );
}
