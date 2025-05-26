import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

// This hook will return the action functions.
// It needs to be callable within the AuthProvider component.
// So it should be a hook that uses useNavigate.

export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithPassword = async (email: string, password: string, captchaToken?: string) => {
    logger.log("Signing in with password:", email, "Captcha token present:", !!captchaToken);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: {
        captchaToken, // Pass the CAPTCHA token to Supabase
      },
    });
    if (error) {
      logger.error("Sign in with password error:", error);
      throw error;
    }
    logger.log("Password sign-in successful");
  };

  const signInWithOTP = async (email: string, captchaToken?: string) => {
    logger.log("Sending OTP to:", email, "Captcha token present:", !!captchaToken);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        captchaToken, // Pass the CAPTCHA token to Supabase
      }
    });
    if (error) {
      logger.error("Sign in with OTP error:", error);
      throw error;
    }
    logger.log("OTP sent successfully");
    return { needsOTP: true };
  };
  
  const signIn = async (email: string, password?: string, captchaToken?: string) => {
    logger.log("Signing in with:", email, "Captcha token present:", !!captchaToken);
    if (password) {
      try {
        await signInWithPassword(email, password, captchaToken);
        return { needsOTP: false };
      } catch (error) {
        logger.error("Password login failed:", error);
        // If password login fails (e.g. invalid credentials), try OTP, but still pass captcha
        if (error instanceof Error && error.message.includes("Invalid login credentials")) {
          logger.log("Password failed, attempting OTP sign-in for:", email);
          return signInWithOTP(email, captchaToken); 
        }
        throw error;
      }
    } else {
      return signInWithOTP(email, captchaToken);
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

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    logger.log("Signing up user:", email, "Captcha token present:", !!captchaToken);
    const { error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        captchaToken, // Pass the CAPTCHA token to Supabase for sign-up
      }
    });
    if (error) {
      logger.error("Sign up error:", error);
      throw error;
    }
    logger.log("Sign up successful, confirmation email sent (if enabled).");
    // Typically, Supabase sends a confirmation email.
    // You might want to navigate to a page indicating this, or to the login page.
    // For now, let's assume the user will be redirected or prompted by Supabase's default behavior.
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
