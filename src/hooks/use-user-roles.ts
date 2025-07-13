
import { useEffect, useState, useMemo } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { EnhancedSecurity } from "@/utils/enhanced-security";

export function useUserRoles(user: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState<Error | null>(null);
  
  const enhancedSecurity = EnhancedSecurity.getInstance();

  useEffect(() => {
    if (user) {
      setIsLoadingRoles(true);
      setRolesError(null); // Reset error on new fetch
      const timerId = setTimeout(async () => {
        try {
          logger.debug(`Fetching roles for user: ${user.id}, email: ${user.email}`);
          
          // Use enhanced security for role checking with logging
          const roles = await enhancedSecurity.secureDataAccess(
            async () => {
              const [adminRoleRes, artistRoleRes, externalRoleRes] = await Promise.all([
                supabase.rpc('has_role', { _user_id: user.id, _role: 'gallery_admin' }),
                supabase.rpc('has_role', { _user_id: user.id, _role: 'artist' }),
                supabase.rpc('has_role', { _user_id: user.id, _role: 'external' })
              ]);

              if (adminRoleRes.error) {
                logger.error("Error fetching admin role:", adminRoleRes.error);
                throw adminRoleRes.error;
              }
              if (artistRoleRes.error) {
                logger.error("Error fetching artist role:", artistRoleRes.error);
                throw artistRoleRes.error;
              }
              if (externalRoleRes.error) {
                logger.error("Error fetching external role:", externalRoleRes.error);
                throw externalRoleRes.error;
              }
              
              return {
                admin: !!adminRoleRes.data,
                artist: !!artistRoleRes.data,
                external: !!externalRoleRes.data
              };
            },
            'user_roles',
            user.id,
            user.id
          );

          setIsAdmin(roles.admin);
          setIsArtist(roles.artist);
          setIsExternal(roles.external);
          logger.log(`Roles set for ${user.email}: Admin=${roles.admin}, Artist=${roles.artist}, External=${roles.external}`);
        } catch (error) {
          logger.error("Exception checking user roles:", error);
          setRolesError(error instanceof Error ? error : new Error("Failed to fetch user roles"));
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
      setIsAdmin(false);
      setIsArtist(false);
      setIsExternal(false);
      setIsLoadingRoles(false);
      setRolesError(null); // Clear error if no user
    }
  }, [user]);

  return useMemo(() => ({
    isAdmin,
    isArtist,
    isExternal,
    isLoadingRoles,
    rolesError, // Expose rolesError
  }), [isAdmin, isArtist, isExternal, isLoadingRoles, rolesError]);
}
