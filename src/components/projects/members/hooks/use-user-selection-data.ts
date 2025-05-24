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
  isOpen: boolean, // isOpen is no longer used to enable the query, but kept for potential future use or clarity
  isDisabled: boolean, // This is the parent-level disabled state
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
        
        // CRITICAL LOG: Log raw data from profiles table
        console.log("useUserSelectionData: Raw data from 'profiles' table:", JSON.stringify(profileData, null, 2));
        console.log("useUserSelectionData: Error from 'profiles' table query:", JSON.stringify(profilesError, null, 2));

        if (profilesError) {
          console.error("useUserSelectionData: Error fetching profiles:", profilesError);
          toast.error(`Failed to load users: ${profilesError.message}`);
          throw profilesError;
        }

        const { data: adminUsersData, error: adminRolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'gallery_admin');
        
        // CRITICAL LOG: Log raw data from user_roles table
        console.log("useUserSelectionData: Raw data from 'user_roles' table:", JSON.stringify(adminUsersData, null, 2));
        console.log("useUserSelectionData: Error from 'user_roles' table query:", JSON.stringify(adminRolesError, null, 2));
        
        if (adminRolesError) {
          console.error("useUserSelectionData: Error fetching admin roles:", adminRolesError);
          // Continue without admin data if it fails, but log it
          // Do not toast here as it might be a partial failure
        }
        
        const adminUserIds = new Set(adminUsersData?.map(user => String(user.user_id)) || []);
        
        const usersBeforeFormatting = profileData || [];
        console.log(`useUserSelectionData: Users from profiles before any formatting: ${usersBeforeFormatting.length}`);
        if (usersBeforeFormatting.length < 10) {
            console.log("useUserSelectionData: Details of users from profiles before formatting:", JSON.stringify(usersBeforeFormatting, null, 2));
        }

        const formattedUsers = usersBeforeFormatting.map(user => ({
          ...user,
          id: String(user.id), // Ensure id is a string
          is_admin: adminUserIds.has(String(user.id)) // Ensure string ID for comparison
        })).filter(user => {
          const hasIdentifier = user.id && (user.display_name || user.email);
          if (!hasIdentifier) {
            console.log("useUserSelectionData: Filtering out user during format due to missing id, display_name, or email:", user);
          }
          return hasIdentifier;
        });

        console.log("useUserSelectionData: Formatted and filtered users count (after display_name/email check):", formattedUsers.length);
        if (formattedUsers.length < 10 && formattedUsers.length > 0) {
            console.log("useUserSelectionData: Formatted and filtered users details:", JSON.stringify(formattedUsers, null, 2));
        } else if (usersBeforeFormatting.length > 0 && formattedUsers.length === 0) {
            console.warn("useUserSelectionData: All users from profiles were filtered out by the display_name/email check. Initial count:", usersBeforeFormatting.length);
        }
        return formattedUsers;
      } catch (err: any) {
        console.error("useUserSelectionData: Critical error in queryFn:", err);
        // Ensure toast message is informative
        const message = err.message || "Failed to load users list due to a network or server error.";
        toast.error(message);
        return []; // Return empty array on critical error
      }
    },
    // Fetch data if the component is not disabled by its parent.
    // `isOpen` is removed from this condition to allow fetching on mount.
    enabled: !isDisabled, 
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1, // Retry once on failure
  });
  
  const memberIds = useMemo(() => {
    const ids = new Set(
      (currentMembers || [])
        .map(member => member && member.user_id ? String(member.user_id) : null) 
        .filter(id => id !== null) as string[]
    );
    // console.log("useUserSelectionData: Current member IDs for exclusion:", Array.from(ids)); // Reduced verbosity
    return ids;
  }, [currentMembers]);
  
  const availableUsers = useMemo(() => {
    if (!Array.isArray(rawUsers)) {
        console.warn("useUserSelectionData: rawUsers is not an array, or query hasn't run/returned yet.", rawUsers);
        return [];
    }
    // console.log("useUserSelectionData: Starting to filter available users. Raw users count:", rawUsers.length, "Member IDs for exclusion:", memberIds.size); // Reduced verbosity

    const filtered = rawUsers.filter(user => {
      if (!user || typeof user.id !== 'string' || user.id.trim() === '') {
        // console.log("useUserSelectionData: Filtering out user due to invalid ID or missing user object:", user); // Reduced verbosity
        return false;
      }
      // This display_name/email check is already done during formattedUsers creation.
      // If it needs to be here, ensure it's not redundant.
      // if (!(user.display_name || user.email)) {
      //   console.log("useUserSelectionData: Filtering out user due to missing display_name and email:", user);
      //   return false;
      // }
      const userIdStr = String(user.id); 
      const isAlreadyMember = memberIds.has(userIdStr);
      
      // if (isAlreadyMember) { // Reduced verbosity
      //   console.log(`useUserSelectionData: Filtering out user '${userIdStr}' (Display: ${user.display_name}, Email: ${user.email}) because they are already a member.`);
      // }
      return !isAlreadyMember;
    });
    
    console.log("useUserSelectionData: Final available users for selection (after excluding members):", filtered.length);
    if (filtered.length < 10 && filtered.length > 0) { 
        console.log("useUserSelectionData: Final available users details:", JSON.stringify(filtered, null, 2));
    }
    if (rawUsers.length > 0 && filtered.length === 0 && memberIds.size < rawUsers.length) {
        console.warn("useUserSelectionData: All users were filtered out by member exclusion. Raw users count:", rawUsers.length, "Member IDs:", Array.from(memberIds));
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
