
import { useEffect, useState, useMemo } from "react"; // Added useMemo
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export function useAuthCoreState() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        // logger.log("Auth state changed (core):", _event, currentSession ? "Session present" : "No session");
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      // logger.log("Initial session retrieved (core):", currentSession ? "Session present" : "No session");
      if (isLoading) { 
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
    }).catch(error => {
        logger.error("Error getting initial session (core):", error);
        if (isLoading) {
            setIsLoading(false);
        }
    });

    return () => {
      // logger.log("Unsubscribing from auth state changes (core).");
      subscription.unsubscribe();
    };
  }, []); // Dependency array is intentionally empty for one-time setup

  return useMemo(() => ({ session, user, isLoading }), [session, user, isLoading]);
}
