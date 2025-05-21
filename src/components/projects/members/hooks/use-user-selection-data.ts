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
        
        const adminUserIds = new Set(adminUsersData?.map(user => String(user.user_id)) || []); // Ensure string IDs
        
        const formattedUsers = (profileData || []).map(user => ({
          ...user,
          id: String(user.id), // Ensure id is a string
          is_admin: adminUserIds.has(String(user.id)) // Ensure string ID for comparison
        })).filter(user => user.id && (user.display_name || user.email)); // Ensure user has an id and some identifier

        console.log("useUserSelectionData: Fetched and formatted users count:", formattedUsers.length);
        if (formattedUsers.length < 10) { // Log details if few users
            console.log("useUserSelectionData: Fetched and formatted users details:", formattedUsers);
        }
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
  
  const memberIds = useMemo(() => {
    const ids = new Set(
      (currentMembers || [])
        .map(member => member && member.user_id ? String(member.user_id) : null) // Ensure string IDs, handle nulls
        .filter(id => id !== null) as string[]
    );
    console.log("useUserSelectionData: Current member IDs for exclusion:", Array.from(ids));
    return ids;
  }, [currentMembers]);
  
  const availableUsers = useMemo(() => {
    if (!Array.isArray(rawUsers)) {
        console.warn("useUserSelectionData: rawUsers is not an array.", rawUsers);
        return [];
    }
    console.log("useUserSelectionData: Starting to filter available users. Raw users count:", rawUsers.length, "Member IDs for exclusion:", memberIds.size);

    const filtered = rawUsers.filter(user => {
      if (!user || typeof user.id !== 'string' || user.id.trim() === '') {
        console.log("useUserSelectionData: Filtering out user due to invalid ID or missing user object:", user);
        return false;
      }
      if (!(user.display_name || user.email)) {
        console.log("useUserSelectionData: Filtering out user due to missing display_name and email:", user);
        return false;
      }
      const userIdStr = String(user.id); // Ensure user.id is string for comparison
      const isAlreadyMember = memberIds.has(userIdStr);
      
      if (isAlreadyMember) {
        console.log(`useUserSelectionData: Filtering out user '${userIdStr}' (Display: ${user.display_name}, Email: ${user.email}) because they are already a member.`);
      } else {
        // console.log(`useUserSelectionData: Keeping user '${userIdStr}' (Display: ${user.display_name}, Email: ${user.email}) as available.`);
      }
      return !isAlreadyMember;
    });
    
    console.log("useUserSelectionData: Filtered available users for selection (count):", filtered.length);
    if (filtered.length < 10 && filtered.length > 0) { // Log details if few users
        console.log("useUserSelectionData: Filtered available users for selection (details):", filtered);
    }
    if (rawUsers.length > 0 && filtered.length === 0 && memberIds.size < rawUsers.length) {
        console.warn("useUserSelectionData: All users were filtered out. Raw users:", rawUsers, "Member IDs:", Array.from(memberIds));
    }
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
