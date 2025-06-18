
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Users, Plus, Minus } from "lucide-react";
import { useClientLists, useAddClientToList, useRemoveClientFromList } from "@/hooks/use-client-lists";

interface ClientListDropdownProps {
  clientId: string;
  clientListIds?: string[];
}

export function ClientListDropdown({ clientId, clientListIds = [] }: ClientListDropdownProps) {
  const { data: lists } = useClientLists();
  const addToList = useAddClientToList();
  const removeFromList = useRemoveClientFromList();

  const handleAddToList = (listId: string) => {
    addToList.mutate({ clientId, listId });
  };

  const handleRemoveFromList = (listId: string) => {
    removeFromList.mutate({ clientId, listId });
  };

  if (!lists || lists.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" />
          Lists
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {lists.map((list) => {
          const isInList = clientListIds.includes(list.id);
          
          return (
            <DropdownMenuItem
              key={list.id}
              onClick={() => isInList ? handleRemoveFromList(list.id) : handleAddToList(list.id)}
              className="cursor-pointer"
            >
              {isInList ? (
                <Minus className="h-4 w-4 mr-2 text-red-500" />
              ) : (
                <Plus className="h-4 w-4 mr-2 text-green-500" />
              )}
              {isInList ? "Remove from" : "Add to"} {list.name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
