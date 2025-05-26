
import { Button } from "@/components/ui/button";
import { Reference } from "./types";

interface ReferenceListProps<T extends { id: string; [key: string]: any }> {
  items: T[];
  nameKey: keyof T;
  isLoading: boolean;
  itemType: Reference['type'];
  onAddReference: (ref: Reference) => void;
  loadingMessage: string;
  noItemsMessage: string;
}

export function ReferenceList<T extends { id: string; [key: string]: any }>({
  items,
  nameKey,
  isLoading,
  itemType,
  onAddReference,
  loadingMessage,
  noItemsMessage,
}: ReferenceListProps<T>) {
  if (isLoading) {
    return <div className="text-center text-sm text-muted-foreground py-4">{loadingMessage}</div>;
  }

  if (items.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-4">{noItemsMessage}</div>;
  }

  return (
    <div className="space-y-1">
      {items.map(item => (
        <div key={item.id} className="flex justify-between items-center p-2 hover:bg-muted rounded-md">
          <div className="text-sm truncate">{String(item[nameKey])}</div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onAddReference({ type: itemType, id: item.id, name: String(item[nameKey]) })}
          >
            Add
          </Button>
        </div>
      ))}
    </div>
  );
}
