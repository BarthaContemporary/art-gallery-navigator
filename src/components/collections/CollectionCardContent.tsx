
import { Collection } from "@/hooks/use-collections";
import { CardContent } from "@/components/ui/card";

interface CollectionCardContentProps {
  collection: Collection;
}

export function CollectionCardContent({ collection }: CollectionCardContentProps) {
  const artworkCount = collection.artworks?.length || 0;
  
  return (
    <CardContent className="p-6">
      <div className="space-y-3">
        <div className="space-y-2">
          <h3 className="font-semibold text-lg text-foreground pr-10 group-hover:text-primary transition-colors truncate">
            {collection.name}
          </h3>
          {collection.description && (
            <p className="text-sm text-muted-foreground leading-relaxed truncate">
              {collection.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{artworkCount}</span>{' '}
              {artworkCount === 1 ? 'artwork' : 'artworks'}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(collection.updated_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </CardContent>
  );
}
