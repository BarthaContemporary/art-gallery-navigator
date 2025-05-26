
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger"; // Added logger import

export function useUserRoles(user: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false); // Added loading state for roles

  useEffect(() => {
    if (user) {
      setIsLoadingRoles(true);
      // Using a setTimeout with 0 delay defers the execution until after the current call stack clears.
      // This can sometimes help with batching state updates or avoiding direct calls within useEffect if they cause issues.
      const timerId = setTimeout(async () => {
        try {
          logger.debug(`Fetching roles for user: ${user.id}, email: ${user.email}`);
          // Performing RPC calls in parallel
          const [adminRoleRes, artistRoleRes, externalRoleRes] = await Promise.all([
            supabase.rpc('has_role', { _user_id: user.id, _role: 'gallery_admin' }),
            supabase.rpc('has_role', { _user_id: user.id, _role: 'artist' }),
            supabase.rpc('has_role', { _user_id: user.id, _role: 'external' })
          ]);

          // Error handling for each RPC call
          if (adminRoleRes.error) logger.error("Error fetching admin role:", adminRoleRes.error);
          if (artistRoleRes.error) logger.error("Error fetching artist role:", artistRoleRes.error);
          if (externalRoleRes.error) logger.error("Error fetching external role:", externalRoleRes.error);
          
          const adminResult = !!adminRoleRes.data;
          const artistResult = !!artistRoleRes.data;
          const externalResult = !!externalRoleRes.data;

          setIsAdmin(adminResult);
          setIsArtist(artistResult);
          setIsExternal(externalResult);
          logger.log(`Roles set for ${user.email}: Admin=${adminResult}, Artist=${artistResult}, External=${externalResult}`);
        } catch (error) {
          logger.error("Exception checking user roles:", error);
          setIsAdmin(false);
          setIsArtist(false);
          setIsExternal(false);
        } finally {
          setIsLoadingRoles(false);
        }
      }, 0);
      return () => {
        clearTimeout(timerId);
        logger.debug("Cleared user roles fetch timer for user:", user.id);
      };
    } else {
      // Reset roles if no user
      setIsAdmin(false);
      setIsArtist(false);
      setIsExternal(false);
      setIsLoadingRoles(false); // Ensure loading is false if no user
    }
  }, [user]); // Effect runs when user object changes

  return { isAdmin, isArtist, isExternal, isLoadingRoles }; // Expose isLoadingRoles
}
