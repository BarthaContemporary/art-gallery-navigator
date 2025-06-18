
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Trash2, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
      <div className="flex items-center gap-2">
        <Select value={selectedListId || "all"} onValueChange={(value) => onListSelect(value === "all" ? undefined : value)}>
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
          </SelectContent>
        </Select>

        {selectedList && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-40 z-50"
              side="bottom"
              sideOffset={4}
            >
              <DropdownMenuItem
                onClick={() => handleEditList(selectedList)}
                className="text-xs"
              >
                <Edit className="h-3 w-3 mr-2" />
                Edit List
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteList(selectedList.id)}
                className="text-red-600 text-xs"
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Delete List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <EditClientListDialog
        list={editingList}
        open={!!editingList}
        onOpenChange={(open) => !open && setEditingList(null)}
      />
    </>
  );
}
