
import { useCollections } from "@/hooks/use-collections";
import { CollectionCard } from "./CollectionCard";
import { Skeleton } from "@/components/ui/skeleton";

export function CollectionGrid() {
  const { data: collections, isLoading, error } = useCollections();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-destructive/20 bg-destructive/5 text-destructive rounded-lg animate-fade-in">
        <h3 className="font-semibold mb-2">Error loading collections</h3>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (!collections || collections.length === 0) {
    return (
      <div className="text-center p-12 border border-dashed border-border rounded-lg bg-muted/20 animate-fade-in">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-foreground">No collections yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first collection to organize and share your artworks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {collections.map((collection, index) => (
        <div 
          key={collection.id} 
          className="animate-fade-in"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <CollectionCard collection={collection} />
        </div>
      ))}
    </div>
  );
}
