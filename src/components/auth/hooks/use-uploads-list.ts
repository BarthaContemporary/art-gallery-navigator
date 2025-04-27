
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProfileData, UploadData } from "../types";

export function useUploadsList() {
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

  const { data: uploads, isLoading, refetch, error } = useQuery({
    queryKey: ['uploads'],
    queryFn: async () => {
      try {
        console.log("Fetching uploads data...");
        const { data, error } = await supabase
          .from('uploads')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error("Error fetching uploads:", error);
          throw error;
        }
        
        console.log("Uploads data fetched:", data);
        
        // Get unique user IDs from uploads
        const userIds = [...new Set(data.map((upload) => upload.uploaded_by))];
        
        if (userIds.length > 0) {
          // Fetch profiles for these user IDs
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);
            
          if (profilesError) {
            console.error("Error fetching profiles:", profilesError);
          } else if (profiles) {
            // Create a mapping of user IDs to display names
            const profileMap: Record<string, string> = {};
            profiles.forEach((profile: ProfileData) => {
              profileMap[profile.id] = profile.display_name || 'Unknown';
            });
            setUserProfiles(profileMap);
          }
        }
        
        return data as UploadData[];
      } catch (err) {
        console.error("Failed to fetch uploads:", err);
        throw err;
      }
    },
  });

  return {
    uploads,
    isLoading,
    error,
    refetch,
    userProfiles
  };
}
