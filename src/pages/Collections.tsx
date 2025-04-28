import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
export default function Collections() {
  return <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-sm font-visby font-extrabold text-slate-700">COLLECTIONS</h1>
        </div>
        <CollectionDialog />
      </div>
      <CollectionGrid />
    </div>;
}
