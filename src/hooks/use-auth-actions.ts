import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// This hook will return the action functions.
// It needs to be callable within the AuthProvider component.
// So it should be a hook that uses useNavigate.

export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithPassword = async (email: string, password: string) => {
    logger.log("Signing in with password:", email);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      logger.error("Sign in with password error:", error);
      throw error;
    }
    logger.log("Password sign-in successful");
  };

  const signInWithOTP = async (email: string) => {
    logger.log("Sending OTP to:", email);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      }
    });
    if (error) {
      logger.error("Sign in with OTP error:", error);
      throw error;
    }
    logger.log("OTP sent successfully");
    return { needsOTP: true };
  };
  
  const signIn = async (email: string, password?: string) => {
    logger.log("Signing in with:", email);
    if (password) {
      try {
        await signInWithPassword(email, password);
        return { needsOTP: false };
      } catch (error) {
        logger.error("Password login failed:", error);
        if (error instanceof Error && error.message.includes("Invalid login credentials")) {
          return signInWithOTP(email);
        }
        throw error;
      }
    } else {
      return signInWithOTP(email);
    }
  };

  const verifyOTP = async (email: string, token: string) => {
    logger.log("Verifying OTP for:", email);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) {
      logger.error("OTP verification error:", error);
      throw error;
    }
    logger.log("OTP verification successful");
    navigate("/");
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      logger.error("Sign up error:", error);
      throw error;
    }
    logger.log("Sign up successful");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error("Sign out error:", error);
      throw error;
    }
    logger.log("Sign out successful");
    navigate("/auth");
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
