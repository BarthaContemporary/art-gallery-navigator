
import { useEffect, useState, useMemo } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export function useUserRoles(user: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isExternal, setIsExternal] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [rolesError, setRolesError] = useState<Error | null>(null);

  useEffect(() => {
    if (user) {
      setIsLoadingRoles(true);
      setRolesError(null);
      const timerId = setTimeout(async () => {
        try {
          const [adminRoleRes, artistRoleRes, externalRoleRes] = await Promise.all([
            supabase.rpc('has_role', { _user_id: user.id, _role: 'gallery_admin' }),
            supabase.rpc('has_role', { _user_id: user.id, _role: 'artist' }),
            supabase.rpc('has_role', { _user_id: user.id, _role: 'external' })
          ]);

          if (adminRoleRes.error) throw adminRoleRes.error;
          if (artistRoleRes.error) throw artistRoleRes.error;
          if (externalRoleRes.error) throw externalRoleRes.error;

          setIsAdmin(!!adminRoleRes.data);
          setIsArtist(!!artistRoleRes.data);
          setIsExternal(!!externalRoleRes.data);
          logger.debug(`Roles set for ${user.email}: Admin=${!!adminRoleRes.data}, Artist=${!!artistRoleRes.data}, External=${!!externalRoleRes.data}`);
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
      return () => clearTimeout(timerId);
    } else {
      setIsAdmin(false);
      setIsArtist(false);
      setIsExternal(false);
      setIsLoadingRoles(false);
      setRolesError(null);
    }
  }, [user]);

  return useMemo(() => ({
    isAdmin,
    isArtist,
    isExternal,
    isLoadingRoles,
    rolesError,
  }), [isAdmin, isArtist, isExternal, isLoadingRoles, rolesError]);
}
