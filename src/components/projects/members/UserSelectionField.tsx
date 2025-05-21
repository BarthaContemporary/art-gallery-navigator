
import { useState, useMemo } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProjectMember } from "@/hooks/projects"; // Updated import
// useAuth removed as isAdmin was not used and useAuth can be heavy if not needed.
// If isAdmin checks are required later, it can be re-added.

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
  
  const { data: rawUsers = [], isLoading, isError: queryError } = useQuery<UserData[], Error>({
    queryKey: ['users-list-with-email-for-selection'],
    queryFn: async () => {
      console.log("UserSelectionField: Fetching users list...");
      try {
        const { data: profileData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .order('display_name');
        
        if (profilesError) {
          console.error("UserSelectionField: Error fetching profiles:", profilesError);
          throw profilesError;
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
        
        const formattedUsers = (profileData || []).map(user => ({
          ...user,
          id: String(user.id), // Ensure id is a string
          is_admin: adminUserIds.has(user.id)
        })).filter(user => user.id && (user.display_name || user.email)); // Ensure user has an id and some identifier

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
    // Ensure rawUsers is an array and filter out any problematic entries early
    if (!Array.isArray(rawUsers)) {
        console.warn("UserSelectionField: rawUsers is not an array.", rawUsers);
        return [];
    }
    const filtered = rawUsers.filter(user => 
      user && 
      typeof user.id === 'string' && 
      user.id.trim() !== '' && // Ensure ID is not empty string
      !memberIds.has(user.id) &&
      (user.display_name || user.email) // Ensure there's a way to identify the user
    );
    console.log("UserSelectionField: Filtered available users for selection:", filtered);
    return filtered;
  }, [rawUsers, memberIds]);

  const handleSelectUser = async (user: UserData) => {
    if (!projectId || !onAddMember || !user || !user.id) {
      console.error("UserSelectionField: Missing data for handleSelectUser", { projectId, onAddMember, user });
      toast.error("Cannot add user: critical information missing.");
      return;
    }
    
    setIsAdding(true);
    try {
      await onAddMember(user.id);
      setOpen(false);
      // Success toast is typically handled by the calling hook (e.g., useAddMember)
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
            disabled={disabled || isAdding || queryError} // Disable if query had an error
            title={queryError ? "Error loading users list" : "Add Team Member"}
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
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading users..." : 
                 queryError ? "Error loading users." :
                 rawUsers.length === 0 ? "No users found in system." :
                 availableUsers.length === 0 ? "All users already added or no suitable users found." : 
                 "No users match your search."}
              </CommandEmpty>
              
              {isLoading && availableUsers.length === 0 && !queryError ? (
                <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading users...
                </div>
              ) : !isLoading && !queryError && availableUsers.length > 0 ? (
                <CommandGroup>
                  {availableUsers.map(user => {
                    // Extra safety check, though availableUsers should be pre-filtered
                    if (!user || !user.id || !(user.display_name || user.email)) {
                      console.warn("UserSelectionField: Skipping render for invalid user in map:", user);
                      return null;
                    }
                    
                    const displayName = user.display_name || user.email || "Unnamed User";
                    const fallbackInitials = (user.display_name?.substring(0, 2) || user.email?.substring(0,2) || "XX").toUpperCase();
                    
                    return (
                      <CommandItem
                        key={user.id}
                        value={user.id} // Must be unique string
                        onSelect={() => handleSelectUser(user)}
                        className="flex items-center gap-2"
                        disabled={isAdding}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
                          <AvatarFallback className="text-xs">
                            {fallbackInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                           <span className="text-sm font-medium">{displayName}</span>
                           {user.email && user.display_name && user.email !== user.display_name && (
                             <span className="text-xs text-muted-foreground">{user.email}</span>
                           )}
                        </div>
                        {user.is_admin && (
                          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Admin
                          </span>
                        )}
                      </CommandItem>
                    );
                  }).filter(Boolean) /* Filter out any nulls from invalid users */ }
                </CommandGroup>
              ) : !isLoading && !queryError && availableUsers.length === 0 ? (
                 <div className="py-6 text-center text-sm text-muted-foreground">
                    {rawUsers.length > 0 ? "All users already added or no suitable users found." : "No users available."}
                  </div>
              ) : queryError ? (
                <div className="py-6 text-center text-sm text-destructive">
                  Failed to load users.
                </div>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

