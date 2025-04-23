
import { useCollections } from "@/hooks/use-collections";
import { CollectionCard } from "./CollectionCard";
import { Skeleton } from "@/components/ui/skeleton";

export function CollectionGrid() {
  const { data: collections, isLoading, error } = useCollections();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-800 rounded-md">
        Error loading collections: {error.message}
      </div>
    );
  }

  if (!collections || collections.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed rounded-lg">
        <p className="text-muted-foreground">No collections yet.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Create a new collection using the button above.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  );
}
