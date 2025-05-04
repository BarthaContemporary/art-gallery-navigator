
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, X, UserIcon } from "lucide-react";
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
  // Ensure initialSelectedIds is always an array, even if it's undefined or null
  const safeInitialIds = Array.isArray(initialSelectedIds) ? initialSelectedIds : [];
  const [selectedIds, setSelectedIds] = useState<string[]>(safeInitialIds);
  const [open, setOpen] = useState(false);
  
  const { data: users = [], isLoading } = useUsers(search);
  
  // Ensure users data is always an array
  const safeUsers = Array.isArray(users) ? users : [];
  
  // Get selected users data for badges - with safe filtering
  const selectedUsers = safeUsers.filter(user => 
    user && user.id && selectedIds.includes(user.id)
  );
  
  // Only notify parent of selection changes if the selected IDs have actually changed
  useEffect(() => {
    try {
      // Check if selectedIds is actually an array before calling the callback
      if (Array.isArray(selectedIds)) {
        onSelectionChange(selectedIds);
      } else {
        // If somehow selectedIds is not an array, reset it and call with empty array
        setSelectedIds([]);
        onSelectionChange([]);
      }
    } catch (error) {
      console.error("Error in UserMultiSelect selection change:", error);
      // Recover from error by resetting to empty selection
      setSelectedIds([]);
      onSelectionChange([]);
    }
  }, [selectedIds, onSelectionChange]);

  // Update selected IDs when initialSelectedIds prop changes - with safety checks
  useEffect(() => {
    try {
      const safeIds = Array.isArray(initialSelectedIds) ? initialSelectedIds : [];
      // Only update if the arrays are different to avoid unnecessary re-renders
      if (JSON.stringify(safeIds) !== JSON.stringify(selectedIds)) {
        setSelectedIds(safeIds);
      }
    } catch (error) {
      console.error("Error updating selected IDs:", error);
      // Default to empty array on error
      setSelectedIds([]);
    }
  }, [initialSelectedIds]);
  
  const handleSelectUser = (userId: string) => {
    if (!userId) return; // Don't process empty IDs
    
    setSelectedIds(prev => {
      try {
        // Ensure prev is an array
        const safeArray = Array.isArray(prev) ? prev : [];
        
        if (safeArray.includes(userId)) {
          return safeArray.filter(id => id !== userId);
        } else {
          return [...safeArray, userId];
        }
      } catch (error) {
        console.error("Error in handleSelectUser:", error);
        // Return empty array on error
        return [];
      }
    });
  };
  
  const handleRemoveUser = (userId: string, e: React.MouseEvent) => {
    if (!userId) return; // Don't process empty IDs
    
    e.stopPropagation();
    setSelectedIds(prev => {
      try {
        // Ensure prev is an array
        const safeArray = Array.isArray(prev) ? prev : [];
        return safeArray.filter(id => id !== userId);
      } catch (error) {
        console.error("Error in handleRemoveUser:", error);
        return [];
      }
    });
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
            {selectedIds && selectedIds.length > 0 
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
              ) : !safeUsers || safeUsers.length === 0 ? (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  No users available.
                </div>
              ) : (
                safeUsers.map(user => {
                  // Only render if user and user.id are defined
                  if (!user || !user.id) return null;
                  
                  return (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => handleSelectUser(user.id)}
                    >
                      <div className={cn(
                        "mr-2 h-4 w-4 border rounded-sm flex items-center justify-center",
                        selectedIds.includes(user.id) 
                          ? "bg-primary border-primary text-primary-foreground" 
                          : "border-input"
                      )}>
                        {selectedIds.includes(user.id) && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                      <span>{user.display_name || "Unnamed User"}</span>
                    </CommandItem>
                  );
                }).filter(Boolean) // Filter out any null items
              )}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      
      {selectedUsers && selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedUsers.map(user => {
            // Only render if user and user.id are defined
            if (!user || !user.id) return null;
            
            return (
              <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
                {user.display_name || "Unnamed User"}
                <X 
                  className="h-3 w-3 cursor-pointer hover:text-destructive" 
                  onClick={(e) => handleRemoveUser(user.id, e)}
                />
              </Badge>
            );
          }).filter(Boolean)} {/* Filter out any null items */}
        </div>
      )}
    </div>
  );
}
