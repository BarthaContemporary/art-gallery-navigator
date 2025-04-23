
import { useCollections } from "@/hooks/use-collections";
import { CollectionCard } from "./CollectionCard";

export function CollectionGrid() {
  const { data: collections, isLoading } = useCollections();

  if (isLoading) {
    return <div className="text-muted-foreground">Loading collections...</div>;
  }

  if (!collections || collections.length === 0) {
    return <div className="text-muted-foreground">No collections yet.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {collections.map((collection) => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  );
}
