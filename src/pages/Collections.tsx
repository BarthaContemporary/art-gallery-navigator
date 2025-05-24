
import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
export default function Collections() {
  return <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        {/* Removed div containing h1 title:
        <div>
          <h1 className="text-sm font-visby font-extrabold text-slate-700">COLLECTIONS</h1>
        </div>
        */}
        <div /> {/* Added an empty div to maintain justify-between with CollectionDialog if it's the only item on the left */}
        <CollectionDialog />
      </div>
      <CollectionGrid />
    </div>;
}

