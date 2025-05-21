
import { useState } from "react";
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
  
  // Fetch all users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list-with-email'],
    queryFn: async () => {
      try {
        // Query profiles table for all users
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .order('display_name');
        
        if (error) throw error;

        // Get admin users
        const { data: adminUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');
        
        const adminUserIds = new Set(adminUsers?.map(user => user.user_id) || []);
        
        // Format data with admin status
        return (data || []).map(user => ({
          ...user,
          is_admin: adminUserIds.has(user.id)
        }));
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users list");
        return [];
      }
    },
    enabled: open && !disabled,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  // Filter out users who are already members
  const memberIds = new Set(members?.map(member => member.user_id) || []);
  const availableUsers = users?.filter(user => !memberIds.has(user.id)) || [];

  const handleSelectUser = async (user: UserData) => {
    if (!projectId || !onAddMember) return;
    
    try {
      setIsAdding(true);
      await onAddMember(user.id);
      setOpen(false);
      toast.success(`Added ${user.display_name || user.email || 'user'} to the project`);
    } catch (error) {
      console.error("Error adding user to project:", error);
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
        <PopoverContent className="p-0" align="start" side="bottom">
          <Command>
            <CommandInput placeholder="Search users..." />
            <CommandEmpty>No users found.</CommandEmpty>
            
            {isLoading ? (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading users...
              </div>
            ) : (
              <CommandGroup>
                {availableUsers.length > 0 ? (
                  availableUsers.map(user => (
                    <CommandItem
                      key={user.id}
                      value={user.id}
                      onSelect={() => handleSelectUser(user)}
                      className="flex items-center gap-2"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {(user.display_name?.substring(0, 2) || user.email?.substring(0,2) || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.display_name || user.email || user.id}</span>
                      {user.is_admin && (
                        <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </CommandItem>
                  ))
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    All users have been added to this project
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
