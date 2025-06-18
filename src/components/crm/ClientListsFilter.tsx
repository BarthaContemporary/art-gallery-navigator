
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground">Loading lists...</div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium text-muted-foreground">Filter by list:</span>
        
        <Button
          variant={!selectedListId ? "default" : "outline"}
          size="sm"
          onClick={() => onListSelect(undefined)}
          className="h-8 text-xs px-3"
        >
          All Clients
        </Button>
        
        {lists?.map((list) => (
          <div key={list.id} className="flex items-center gap-1">
            <Button
              variant={selectedListId === list.id ? "default" : "outline"}
              size="sm"
              onClick={() => onListSelect(list.id)}
              className="h-8 text-xs px-3"
            >
              <span className="flex items-center gap-1">
                {list.name}
                <ListMemberCount listId={list.id} />
              </span>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  onClick={() => handleEditList(list)}
                  className="text-xs"
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit List
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteList(list.id)}
                  className="text-red-600 text-xs"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete List
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        
        {(!lists || lists.length === 0) && (
          <span className="text-xs text-muted-foreground">
            No lists created yet
          </span>
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
