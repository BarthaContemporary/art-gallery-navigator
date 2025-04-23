
import { CollectionGrid } from "@/components/collections/CollectionGrid";
import { CollectionDialog } from "@/components/collections/CollectionDialog";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Collections() {
  return (
    <div className="pt-6 pb-6 px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <List className="w-6 h-6" />
          Collections
        </h1>
        <CollectionDialog />
      </div>
      <CollectionGrid />
    </div>
  );
}
