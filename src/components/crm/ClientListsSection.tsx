
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Users, Trash2, Edit } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateClientListDialog } from "./CreateClientListDialog";
import { EditClientListDialog } from "./EditClientListDialog";
import { useClientLists, useDeleteClientList, useClientListMembers } from "@/hooks/use-client-lists";
import { ClientList } from "@/hooks/use-client-lists";

interface ClientListsSectionProps {
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

export function ClientListsSection({ selectedListId, onListSelect }: ClientListsSectionProps) {
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
      <Card className="border-0 shadow-none">
        <CardHeader className="p-3 pb-0">
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="text-xs text-muted-foreground">Loading lists...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-none">
        <CardHeader className="p-3 pb-0">
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-1">
            <Button
              variant={!selectedListId ? "default" : "ghost"}
              size="sm"
              onClick={() => onListSelect(undefined)}
              className="w-full justify-start h-7 text-xs px-2"
            >
              All Clients
            </Button>
            
            {lists?.map((list) => (
              <div key={list.id} className="flex items-center gap-1">
                <Button
                  variant={selectedListId === list.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onListSelect(list.id)}
                  className="flex-1 justify-start h-7 text-xs px-2"
                >
                  <span className="flex items-center flex-1 text-left">
                    <span className="truncate">{list.name}</span>
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
              <div className="text-center py-2 text-xs text-muted-foreground">
                No lists created yet. Create your first list to organize clients.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <EditClientListDialog
        list={editingList}
        open={!!editingList}
        onOpenChange={(open) => !open && setEditingList(null)}
      />
    </>
  );
}
