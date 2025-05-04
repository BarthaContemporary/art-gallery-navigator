
import { useState, useEffect } from "react";
import { CheckIcon, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useUsers } from "@/hooks/use-users";
import { cn } from "@/lib/utils";

interface UserMultiSelectProps {
  onSelectionChange: (selectedIds: string[]) => void;
  initialSelectedIds?: string[];
}

export function UserMultiSelect({ onSelectionChange, initialSelectedIds = [] }: UserMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [open, setOpen] = useState(false);
  
  const { data: users = [], isLoading } = useUsers(search);
  
  // Make sure users is always an array, even if data is undefined
  const safeUsers = Array.isArray(users) ? users : [];
  
  // Selected users info for displaying badges - filter from safe users array
  const selectedUsers = safeUsers.filter(user => selectedIds.includes(user.id));
  
  useEffect(() => {
    onSelectionChange(selectedIds);
  }, [selectedIds, onSelectionChange]);
  
  const toggleUser = (userId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };
  
  const removeUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.filter(id => id !== userId));
  };
  
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedIds.length > 0 
              ? `${selectedIds.length} user${selectedIds.length > 1 ? 's' : ''} selected`
              : "Select users..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput 
              placeholder="Search users..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {isLoading ? (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  Loading users...
                </div>
              ) : (
                safeUsers.map(user => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => toggleUser(user.id)}
                  >
                    <div className={cn(
                      "mr-2 h-4 w-4 border rounded-sm flex items-center justify-center",
                      selectedIds.includes(user.id) 
                        ? "bg-primary border-primary text-primary-foreground" 
                        : "border-input"
                    )}>
                      {selectedIds.includes(user.id) && (
                        <CheckIcon className="h-3 w-3" />
                      )}
                    </div>
                    <span>{user.display_name}</span>
                  </CommandItem>
                ))
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map(user => (
            <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
              {user.display_name}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={(e) => removeUser(user.id, e)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
