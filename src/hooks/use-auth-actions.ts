import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithPassword = async (email: string, password: string, captchaToken?: string) => {
    logger.log("AuthActions: Signing in with password for:", email, "Captcha token present:", !!captchaToken);
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken,
      },
    });
    if (error) {
      logger.error("AuthActions: Sign in with password error:", error.message, { email, errorDetails: error });
      throw error;
    }
    logger.log("AuthActions: Password sign-in successful for:", email, "Session:", data.session ? "Present" : "Absent");
  };

  const signInWithOTP = async (email: string, captchaToken?: string) => {
    logger.log("AuthActions: Sending OTP to:", email, "Captcha token present:", !!captchaToken);
    const { error, data } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Important: This might need adjustment based on desired UX for new users
        captchaToken,
      }
    });
    if (error) {
      logger.error("AuthActions: Sign in with OTP error:", error.message, { email, errorDetails: error });
      throw error;
    }
    logger.log("AuthActions: OTP sent successfully to:", email, "Data:", data);
    return { needsOTP: true };
  };
  
  const signIn = async (email: string, password?: string, captchaToken?: string) => {
    logger.log("AuthActions: Unified sign-in attempt for:", email, "Password provided:", !!password, "Captcha token present:", !!captchaToken);
    if (password) {
      try {
        await signInWithPassword(email, password, captchaToken);
        return { needsOTP: false };
      } catch (error) {
        logger.warn("AuthActions: Password login failed for:", email, "Error:", (error as Error).message);
        // Consider if OTP fallback is always desired or if specific errors should prevent it.
        // For instance, if captcha fails on password attempt, should it re-try with OTP using the same (potentially invalid) captcha?
        // The current logic will attempt OTP if password auth fails (e.g. "Invalid login credentials").
        if (error instanceof Error && error.message.toLowerCase().includes("invalid login credentials")) {
          logger.log("AuthActions: Password failed with 'Invalid login credentials', attempting OTP sign-in for:", email);
          return signInWithOTP(email, captchaToken); 
        }
        throw error; // Re-throw other errors (like network errors, or potentially captcha errors from Supabase)
      }
    } else {
      logger.log("AuthActions: No password provided, proceeding with OTP sign-in for:", email);
      return signInWithOTP(email, captchaToken);
    }
  };

  const verifyOTP = async (email: string, token: string) => {
    logger.log("AuthActions: Verifying OTP for:", email);
    const { error, data } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email' // Assuming email OTP. If other types like 'sms' are used, this needs to be dynamic.
    });
    if (error) {
      logger.error("AuthActions: OTP verification error:", error.message, { email, errorDetails: error });
      throw error;
    }
    logger.log("AuthActions: OTP verification successful for:", email, "Session:", data.session ? "Present" : "Absent");
    // Successful OTP verification usually means the user is now logged in.
    // The onAuthStateChange listener should pick up the new session.
    // Navigation can happen here or be driven by the AuthProvider/RequireAuth components based on session state.
    // navigate("/"); // Keeping this commented as Auth.tsx handles redirection based on user state.
  };

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    logger.log("AuthActions: Signing up user:", email, "Captcha token present:", !!captchaToken);
    const { error, data } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        captchaToken, 
      }
    });
    if (error) {
      logger.error("AuthActions: Sign up error:", error.message, { email, errorDetails: error });
      throw error;
    }
    // Supabase returns user and session data upon successful sign-up if email confirmation is disabled.
    // If email confirmation is enabled, data.user will exist but data.session will be null.
    logger.log("AuthActions: Sign up successful for:", email, "User created:", !!data.user, "Session provided:", !!data.session);
    // Navigation or messaging about email confirmation should be handled by the calling component.
  };

  const signOut = async () => {
    logger.log("AuthActions: Signing out current user.");
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error("AuthActions: Sign out error:", error.message, { errorDetails: error });
      throw error;
    }
    logger.log("AuthActions: Sign out successful. Navigating to /auth.");
    navigate("/auth", { replace: true }); // Ensure navigation occurs after successful sign out
  };

  return {
    signIn,
    signInWithPassword,
    signInWithOTP,
    verifyOTP,
    signUp,
    signOut,
  };
}
