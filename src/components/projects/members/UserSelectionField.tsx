
import { useState, useMemo } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProjectMember } from "@/hooks/projects/types/member-types";
import { useAuth } from "@/hooks/use-auth";

interface UserData {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  is_admin?: boolean;
}

interface UserSelectionFieldProps {
  projectId?: string;
  disabled?: boolean;
  onAddMember?: (userId: string) => Promise<void>;
  members: ProjectMember[];
}

export function UserSelectionField({ 
  projectId, 
  disabled = false, 
  onAddMember,
  members 
}: UserSelectionFieldProps) {
  const [open, setOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { isAdmin } = useAuth();
  
  const { data: rawUsers = [], isLoading } = useQuery<UserData[], Error>({
    queryKey: ['users-list-with-email-for-selection'],
    queryFn: async () => {
      console.log("UserSelectionField: Fetching users list...");
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .order('display_name');
        
        if (error) {
          console.error("UserSelectionField: Error fetching profiles:", error);
          throw error;
        }

        const { data: adminUsersData, error: adminRolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');
        
        if (adminRolesError) {
          console.error("UserSelectionField: Error fetching admin roles:", adminRolesError);
          // Continue without admin data if it fails, but log it
        }
        
        const adminUserIds = new Set(adminUsersData?.map(user => user.user_id) || []);
        
        const formattedUsers = (data || []).map(user => ({
          ...user,
          id: String(user.id), // Ensure id is a string
          is_admin: adminUserIds.has(user.id)
        }));
        console.log("UserSelectionField: Fetched and formatted users:", formattedUsers);
        return formattedUsers;
      } catch (error) {
        console.error("UserSelectionField: Critical error in queryFn:", error);
        toast.error("Failed to load users list due to a network or server error.");
        return []; // Return empty array on critical error
      }
    },
    enabled: open && !disabled,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  const memberIds = useMemo(() => new Set(members?.map(member => member.user_id) || []), [members]);
  
  const availableUsers = useMemo(() => {
    const filtered = rawUsers.filter(user => user && typeof user.id === 'string' && !memberIds.has(user.id));
    console.log("UserSelectionField: Available users for selection:", filtered);
    return filtered;
  }, [rawUsers, memberIds]);

  const handleSelectUser = async (user: UserData) => {
    if (!projectId || !onAddMember || !user || !user.id) {
      console.error("UserSelectionField: Missing data for handleSelectUser", { projectId, onAddMember, user });
      toast.error("Cannot add user: critical information missing.");
      return;
    }
    
    try {
      setIsAdding(true);
      await onAddMember(user.id);
      setOpen(false);
      // Toast success is handled by the useAddMember hook typically
    } catch (error) {
      console.error("UserSelectionField: Error adding user to project:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to add user to project";
      toast.error(errorMsg);
    } finally {
      setIsAdding(false);
    }
  };
  
  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 w-full justify-start"
            disabled={disabled || isAdding}
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Add Team Member
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start" side="bottom">
          <Command>
            <CommandInput placeholder="Search users..." />
            <CommandEmpty>
              {isLoading ? "Loading..." : "No users found."}
            </CommandEmpty>
            
            {isLoading && availableUsers.length === 0 ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading users...
              </div>
            ) : (
              <CommandGroup>
                {availableUsers.length > 0 ? (
                  availableUsers.map(user => {
                    const displayName = user.display_name || user.email || "Unnamed User";
                    const fallbackInitials = (user.display_name?.substring(0, 2) || user.email?.substring(0,2) || "XX").toUpperCase();
                    
                    return (
                      <CommandItem
                        key={user.id}
                        value={user.id} // Must be unique string
                        onSelect={() => handleSelectUser(user)}
                        className="flex items-center gap-2"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
                          <AvatarFallback className="text-xs">
                            {fallbackInitials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{displayName}</span>
                        {user.is_admin && (
                          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </CommandItem>
                    );
                  })
                ) : (
                  !isLoading && <div className="py-6 text-center text-sm text-muted-foreground">
                    {rawUsers.length > 0 ? "All users already added or not available." : "No users available to add."}
                  </div>
                )}
              </CommandGroup>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
