
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UploadData } from "../types";
import { useProfilesMap } from "./use-profiles-map";

export function useUploadsList() {
  const { data: uploads, isLoading, refetch, error } = useQuery({
    queryKey: ['uploads'],
    queryFn: async () => {
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
      return data as UploadData[];
    },
  });

  const userIds = uploads ? [...new Set(uploads.map(upload => upload.uploaded_by))] : [];
  const { userProfiles, fetchProfiles } = useProfilesMap(userIds);

  // Fetch profiles when uploads change
  if (uploads && !isLoading) {
    fetchProfiles(userIds);
  }

  return {
    uploads,
    isLoading,
    error,
    refetch,
    userProfiles
  };
}
