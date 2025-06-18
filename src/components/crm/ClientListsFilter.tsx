
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, Edit, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { EditClientListDialog } from "./EditClientListDialog";
import { useClientLists, useDeleteClientList, useClientListMembers } from "@/hooks/use-client-lists";
import { ClientList } from "@/hooks/use-client-lists";

interface ClientListsFilterProps {
  selectedListId?: string;
  onListSelect: (listId: string | undefined) => void;
}

function ListMemberCount({ listId }: { listId: string }) {
  const { data: members } = useClientListMembers(listId);
  const count = members?.length || 0;
  
  if (count === 0) return null;
  
  return (
    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0.5 h-4">
      {count}
    </Badge>
  );
}

export function ClientListsFilter({ selectedListId, onListSelect }: ClientListsFilterProps) {
  const [editingList, setEditingList] = useState<ClientList | null>(null);
  const { data: lists, isLoading } = useClientLists();
  const deleteList = useDeleteClientList();

  const handleDeleteList = (listId: string) => {
    if (confirm("Are you sure you want to delete this list? This will not delete the clients themselves.")) {
      deleteList.mutate(listId);
      if (selectedListId === listId) {
        onListSelect(undefined);
      }
    }
  };

  const handleEditList = (list: ClientList) => {
    setEditingList(list);
  };

  const handleValueChange = (value: string) => {
    if (value === "all") {
      onListSelect(undefined);
    } else if (value.startsWith("edit-")) {
      const listId = value.replace("edit-", "");
      const list = lists?.find(l => l.id === listId);
      if (list) {
        handleEditList(list);
      }
    } else if (value.startsWith("delete-")) {
      const listId = value.replace("delete-", "");
      handleDeleteList(listId);
    } else {
      onListSelect(value);
    }
  };

  const selectedList = lists?.find(list => list.id === selectedListId);

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[85px] sm:w-[100px] h-5 text-xs px-1.5 gap-1">
          <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <SelectValue placeholder="Loading..." />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <>
      <Select value={selectedListId || "all"} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[85px] sm:w-[100px] h-5 text-xs px-1.5 gap-1">
          <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <SelectValue>
            <div className="flex items-center">
              {selectedList ? (
                <>
                  {selectedList.name}
                  <ListMemberCount listId={selectedList.id} />
                </>
              ) : (
                "All Lists"
              )}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent 
          position="popper"
          side="bottom"
          align="start"
          className="z-50 min-w-[200px] max-h-[300px] overflow-hidden"
          sideOffset={4}
        >
          <SelectItem value="all" className="text-xs">All Lists</SelectItem>
          {lists?.map((list) => (
            <SelectItem key={list.id} value={list.id} className="text-xs">
              <div className="flex items-center justify-between w-full">
                <span>{list.name}</span>
                <ListMemberCount listId={list.id} />
              </div>
            </SelectItem>
          ))}
          {(!lists || lists.length === 0) && (
            <SelectItem value="empty" disabled className="text-xs">
              No lists created yet
            </SelectItem>
          )}
          
          {selectedList && (
            <>
              <SelectSeparator />
              <SelectItem value={`edit-${selectedList.id}`} className="text-xs">
                <div className="flex items-center">
                  <Edit className="h-3 w-3 mr-2" />
                  Edit "{selectedList.name}"
                </div>
              </SelectItem>
              <SelectItem value={`delete-${selectedList.id}`} className="text-xs text-red-600">
                <div className="flex items-center">
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete "{selectedList.name}"
                </div>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      <EditClientListDialog
        list={editingList}
        open={!!editingList}
        onOpenChange={(open) => !open && setEditingList(null)}
      />
    </>
  );
}
