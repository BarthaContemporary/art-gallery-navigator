
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "@/components/ui/use-toast";

export function usePasswordRecoverySession() {
  const [authEventTriggered, setAuthEventTriggered] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false); // Indicates if we can proceed
  const navigate = useNavigate();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      logger.log("usePasswordRecoverySession: Auth state changed", event, session ? "Session present" : "No session");
      if (event === "PASSWORD_RECOVERY") {
        setAuthEventTriggered(true);
        setIsSessionReady(true);
        logger.log("usePasswordRecoverySession: PASSWORD_RECOVERY event received. Session is ready for password update.");
      } else if (!session && !authEventTriggered) {
        // If there's no session and no PASSWORD_RECOVERY event has been triggered yet.
        // This timeout allows Supabase to process the URL hash if it hasn't already.
        setTimeout(async () => {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!authEventTriggered && !currentSession) { 
            logger.warn("usePasswordRecoverySession: No active session for password recovery after delay. Redirecting to login.");
            toast({
              title: "Invalid or Expired Link",
              description: "The password reset link may be invalid or expired. Please request a new link.",
              variant: "destructive",
            });
            navigate("/auth");
          } else if (currentSession && !authEventTriggered) {
            // This case is less likely if PASSWORD_RECOVERY is working, but as a fallback:
            // If a session exists but PASSWORD_RECOVERY didn't fire, assume it's a recovery session.
            logger.log("usePasswordRecoverySession: Session found, but PASSWORD_RECOVERY event missed. Assuming recovery session.");
            setAuthEventTriggered(true); // Manually trigger if session exists but event was missed
            setIsSessionReady(true);
          }
        }, 1500);
      } else if (session && !authEventTriggered) {
        // If a session exists but PASSWORD_RECOVERY hasn't fired, it could be a normal signed-in user
        // or Supabase just set up the recovery session. The timeout above should clarify.
        // For now, assume it might become a recovery session.
        logger.log("usePasswordRecoverySession: Session present, waiting for PASSWORD_RECOVERY or timeout check.");
      }
    });

    // Initial check for session, in case onAuthStateChange hasn't fired yet or missed the initial state.
    async function checkInitialSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        // If a session exists, we anticipate PASSWORD_RECOVERY event.
        // If it doesn't fire, the timeout logic above will handle it.
        // We can tentatively set session as ready if user is present,
        // this will be firmed up by PASSWORD_RECOVERY event.
        logger.log("usePasswordRecoverySession: Initial session check found a user. Awaiting PASSWORD_RECOVERY event.");
        // setIsSessionReady(true); // Let PASSWORD_RECOVERY event confirm this.
      } else if (!session) {
        // If no session on initial check, onAuthStateChange with timeout will handle redirection.
        logger.log("usePasswordRecoverySession: Initial session check found no user.");
      }
    }
    checkInitialSession();

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, [navigate, authEventTriggered]);

  return { authEventTriggered, isSessionReady };
}
