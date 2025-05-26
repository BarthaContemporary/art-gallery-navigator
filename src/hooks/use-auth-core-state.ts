
import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger"; // Added logger import

export function useAuthCoreState() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This effect should run once to set up listeners and get the initial session.
    setIsLoading(true); // Explicitly set loading to true at the start of the effect run

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        logger.log("Auth state changed (core):", event, currentSession ? "Session present" : "No session");
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false); // Auth state determined
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      logger.log("Initial session retrieved (core):", currentSession ? "Session present" : "No session");
      // Only update and set isLoading if it's still true.
      // This handles cases where onAuthStateChange might fire very quickly.
      if (isLoading) { 
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
    }).catch(error => {
        logger.error("Error getting initial session (core):", error);
        if (isLoading) { // Ensure loading becomes false even on error during initial phase
            setIsLoading(false);
        }
    });

    return () => {
      logger.log("Unsubscribing from auth state changes (core).");
      subscription.unsubscribe();
    };
  }, []); // Corrected dependency array to []


  return { session, user, isLoading };
}
