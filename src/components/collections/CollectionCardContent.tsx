
import { Collection } from "@/hooks/use-collections";
import { CardContent } from "@/components/ui/card";

interface CollectionCardContentProps {
  collection: Collection;
}

export function CollectionCardContent({ collection }: CollectionCardContentProps) {
  return (
    <CardContent className="p-4">
      <h2 className="font-semibold text-lg truncate pr-10">{collection.name}</h2>
      {collection.description && (
        <p className="text-sm text-muted-foreground mt-1 truncate">{collection.description}</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium">{collection.artworks?.length || 0}</span>{' '}
          {(collection.artworks?.length || 0) === 1 ? 'artwork' : 'artworks'}
        </div>
      </div>
    </CardContent>
  );
}
