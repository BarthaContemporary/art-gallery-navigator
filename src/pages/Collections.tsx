
import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";

export default function Collections() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl tracking-wide font-semibold">Collections</h1>
          <p className="text-muted-foreground">
            Browse and manage your artwork collections
          </p>
        </div>
        <CollectionDialog />
      </div>
      <CollectionGrid />
    </div>
  );
}
