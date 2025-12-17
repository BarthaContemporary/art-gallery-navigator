
import { useEffect, useState, useMemo, useRef } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const AUTH_TIMEOUT_MS = 1500; // Max time to wait for auth state

export function useAuthCoreState() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const loadingResolvedRef = useRef(false);

  useEffect(() => {
    // Set a timeout to stop loading even if auth check fails/hangs
    const timeoutId = setTimeout(() => {
      if (!loadingResolvedRef.current) {
        loadingResolvedRef.current = true;
        setIsLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        if (!loadingResolvedRef.current) {
          loadingResolvedRef.current = true;
        }
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!loadingResolvedRef.current) {
        loadingResolvedRef.current = true;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
    }).catch(error => {
      logger.error("Error getting initial session (core):", error);
      if (!loadingResolvedRef.current) {
        loadingResolvedRef.current = true;
        setIsLoading(false);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  return useMemo(() => ({ session, user, isLoading }), [session, user, isLoading]);
}
