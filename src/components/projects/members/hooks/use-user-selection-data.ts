
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectMember } from "@/hooks/projects";

export interface UserData {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  email: string | null;
  is_admin?: boolean;
}

export function useUserSelectionData(
  isOpen: boolean,
  isDisabled: boolean,
  currentMembers: ProjectMember[]
) {
  const { data: rawUsers = [], isLoading, isError: queryError, error } = useQuery<UserData[], Error>({
    queryKey: ['users-list-with-email-for-selection'],
    queryFn: async () => {
      console.log("useUserSelectionData: Fetching users list...");
      try {
        const { data: profileData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .order('display_name');
        
        if (profilesError) {
          console.error("useUserSelectionData: Error fetching profiles:", profilesError);
          throw profilesError;
        }

        const { data: adminUsersData, error: adminRolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');
        
        if (adminRolesError) {
          console.error("useUserSelectionData: Error fetching admin roles:", adminRolesError);
          // Continue without admin data if it fails, but log it
        }
        
        const adminUserIds = new Set(adminUsersData?.map(user => user.user_id) || []);
        
        const formattedUsers = (profileData || []).map(user => ({
          ...user,
          id: String(user.id), // Ensure id is a string
          is_admin: adminUserIds.has(user.id)
        })).filter(user => user.id && (user.display_name || user.email)); // Ensure user has an id and some identifier

        console.log("useUserSelectionData: Fetched and formatted users:", formattedUsers);
        return formattedUsers;
      } catch (err) {
        console.error("useUserSelectionData: Critical error in queryFn:", err);
        toast.error("Failed to load users list due to a network or server error.");
        return []; // Return empty array on critical error
      }
    },
    enabled: isOpen && !isDisabled,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
  const memberIds = useMemo(() => new Set(currentMembers?.map(member => member.user_id) || []), [currentMembers]);
  
  const availableUsers = useMemo(() => {
    if (!Array.isArray(rawUsers)) {
        console.warn("useUserSelectionData: rawUsers is not an array.", rawUsers);
        return [];
    }
    const filtered = rawUsers.filter(user => 
      user && 
      typeof user.id === 'string' && 
      user.id.trim() !== '' &&
      !memberIds.has(user.id) &&
      (user.display_name || user.email)
    );
    console.log("useUserSelectionData: Filtered available users for selection:", filtered);
    return filtered;
  }, [rawUsers, memberIds]);

  return {
    rawUsers,
    availableUsers,
    isLoadingUsers: isLoading,
    usersQueryError: queryError,
    usersError: error,
  };
}
