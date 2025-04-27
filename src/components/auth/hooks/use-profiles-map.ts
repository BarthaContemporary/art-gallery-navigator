
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProfileData } from "../types";

export function useProfilesMap(userIds: string[]) {
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({});

  const fetchProfiles = async (ids: string[]) => {
    if (ids.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids);
        
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
      } else if (profiles) {
        const profileMap: Record<string, string> = {};
        profiles.forEach((profile: ProfileData) => {
          profileMap[profile.id] = profile.display_name || 'Unknown';
        });
        setUserProfiles(profileMap);
      }
    }
  };

  return {
    userProfiles,
    fetchProfiles
  };
}
