
import { useCollections } from "@/hooks/use-collections";
import { CollectionDialog } from "./CollectionDialog";
import { Card } from "@/components/ui/card";
import { List } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CollectionList() {
  const { data: collections, isLoading } = useCollections();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <List className="w-6 h-6" />
          Collections
        </h1>
        <CollectionDialog />
      </div>
      {isLoading && (
        <div className="text-muted-foreground">Loading collections...</div>
      )}
      {collections?.length === 0 && (
        <div className="text-muted-foreground">No collections yet.</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {collections?.map((col) => (
          <Card key={col.id} className="p-4">
            <h2 className="font-semibold text-lg">{col.name}</h2>
            {col.description && (
              <p className="text-sm text-muted-foreground mb-2">{col.description}</p>
            )}
            {col.artworks && col.artworks.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1">Artworks:</div>
                <ul className="list-disc list-inside space-y-1">
                  {col.artworks.map((art) => (
                    <li key={art.id}>{art.title}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
