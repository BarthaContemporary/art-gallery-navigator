
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Users, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateClientListDialog } from "./CreateClientListDialog";
import { useClientLists, useDeleteClientList } from "@/hooks/use-client-lists";

interface ClientListsSectionProps {
  selectedListId?: string;
  onListSelect: (listId: string | undefined) => void;
}

export function ClientListsSection({ selectedListId, onListSelect }: ClientListsSectionProps) {
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Client Lists
            </span>
            <CreateClientListDialog />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading lists...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Client Lists
          </span>
          <CreateClientListDialog />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Button
            variant={!selectedListId ? "default" : "ghost"}
            size="sm"
            onClick={() => onListSelect(undefined)}
            className="w-full justify-start"
          >
            All Clients
          </Button>
          
          {lists?.map((list) => (
            <div key={list.id} className="flex items-center gap-2">
              <Button
                variant={selectedListId === list.id ? "default" : "ghost"}
                size="sm"
                onClick={() => onListSelect(list.id)}
                className="flex-1 justify-start"
              >
                {list.name}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => handleDeleteList(list.id)}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete List
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          
          {(!lists || lists.length === 0) && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No lists created yet. Create your first list to organize clients.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
