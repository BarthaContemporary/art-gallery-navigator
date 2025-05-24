
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useUserRoles(user: User | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isArtist, setIsArtist] = useState(false);
  const [isExternal, setIsExternal] = useState(false);

  useEffect(() => {
    if (user) {
      const timerId = setTimeout(async () => {
        try {
          console.log(`Fetching roles for user: ${user.id}`);
          const { data: adminRole } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'gallery_admin'
          });
          const { data: artistRole } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'artist'
          });
          const { data: externalRole } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'external'
          });
          setIsAdmin(!!adminRole);
          setIsArtist(!!artistRole);
          setIsExternal(!!externalRole);
          console.log(`Roles set for ${user.email}: Admin=${!!adminRole}, Artist=${!!artistRole}, External=${!!externalRole}`);
        } catch (error) {
          console.error("Error checking user roles:", error);
          setIsAdmin(false);
          setIsArtist(false);
          setIsExternal(false);
        }
      }, 0);
      return () => clearTimeout(timerId);
    } else {
      setIsAdmin(false);
      setIsArtist(false);
      setIsExternal(false);
    }
  }, [user]);

  return { isAdmin, isArtist, isExternal };
}
