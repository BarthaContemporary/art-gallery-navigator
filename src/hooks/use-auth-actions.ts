
import { useNavigate } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { retryWithBackoff } from "@/lib/retry-with-backoff";

export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithPassword = useCallback(async (email: string, password: string, captchaToken?: string) => {
    logger.log("AuthActions: Signing in with password for:", email, "Captcha token present:", !!captchaToken);
    
    if (!captchaToken || captchaToken.trim() === '') {
      throw new Error("Security verification is required for login");
    }
    
    const { error, data } = await retryWithBackoff(
      () => supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: captchaToken
        }
      }),
      {
        maxRetries: 3,
        onRetry: (attempt, err) => {
          logger.log(`AuthActions: Retrying password sign-in (attempt ${attempt}) for:`, email);
        }
      }
    );
    
    if (error) {
      logger.error("AuthActions: Sign in with password error:", error.message, { email, errorDetails: error });
      throw error;
    }
    
    logger.log("AuthActions: Password sign-in successful for:", email, "Session:", data.session ? "Present" : "Absent");
  }, []);

  const signInWithOTP = useCallback(async (email: string, captchaToken?: string) => {
    logger.log("AuthActions: Sending OTP to:", email, "Captcha token present:", !!captchaToken);
    
    if (!captchaToken || captchaToken.trim() === '') {
      throw new Error("Security verification is required for OTP requests");
    }
    
    const { error, data } = await retryWithBackoff(
      () => supabase.auth.signInWithOtp({
        email,
        options: { 
          shouldCreateUser: false,
          captchaToken: captchaToken
        }
      }),
      {
        maxRetries: 3,
        onRetry: (attempt) => {
          logger.log(`AuthActions: Retrying OTP request (attempt ${attempt}) for:`, email);
        }
      }
    );
    
    if (error) {
      logger.error("AuthActions: Sign in with OTP error:", error.message, { email, errorDetails: error });
      throw error;
    }
    
    logger.log("AuthActions: OTP sent successfully to:", email, "Data:", data);
    return { needsOTP: true };
  }, []);
  
  const signIn = useCallback(async (email: string, password?: string, captchaToken?: string) => {
    logger.log("AuthActions: Unified sign-in attempt for:", email, "Password provided:", !!password, "Captcha token present:", !!captchaToken);
    
    if (!captchaToken || captchaToken.trim() === '') {
      throw new Error("Security verification is required");
    }
    
    if (password) {
      try {
        await signInWithPassword(email, password, captchaToken);
        return { needsOTP: false };
      } catch (error) {
        logger.warn("AuthActions: Password login failed for:", email, "Error:", (error as Error).message);
        if (error instanceof Error && error.message.toLowerCase().includes("invalid login credentials")) {
          logger.log("AuthActions: Password failed with 'Invalid login credentials', attempting OTP sign-in for:", email);
          return signInWithOTP(email, captchaToken); 
        }
        throw error;
      }
    } else {
      logger.log("AuthActions: No password provided, proceeding with OTP sign-in for:", email);
      return signInWithOTP(email, captchaToken);
    }
  }, [signInWithPassword, signInWithOTP]);

  const verifyOTP = useCallback(async (email: string, token: string) => {
    logger.log("AuthActions: Verifying OTP for:", email);
    
    const { error, data } = await retryWithBackoff(
      () => supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      }),
      {
        maxRetries: 2,
        onRetry: (attempt) => {
          logger.log(`AuthActions: Retrying OTP verification (attempt ${attempt}) for:`, email);
        }
      }
    );
    
    if (error) {
      logger.error("AuthActions: OTP verification error:", error.message, { email, errorDetails: error });
      throw error;
    }
    logger.log("AuthActions: OTP verification successful for:", email, "Session:", data.session ? "Present" : "Absent");
  }, []);

  const signUp = useCallback(async (email: string, password: string, captchaToken?: string) => {
    logger.log("AuthActions: Signing up user:", email, "Captcha token present:", !!captchaToken);
    
    if (!captchaToken || captchaToken.trim() === '') {
      throw new Error("Security verification is required for registration");
    }
    
    const { error, data } = await retryWithBackoff(
      () => supabase.auth.signUp({ 
        email, 
        password,
        options: {
          captchaToken: captchaToken
        }
      }),
      {
        maxRetries: 3,
        onRetry: (attempt) => {
          logger.log(`AuthActions: Retrying sign-up (attempt ${attempt}) for:`, email);
        }
      }
    );
    
    if (error) {
      logger.error("AuthActions: Sign up error:", error.message, { email, errorDetails: error });
      throw error;
    }
    
    logger.log("AuthActions: Sign up successful for:", email, "User created:", !!data.user, "Session provided:", !!data.session);
  }, []);

  const signOut = useCallback(async () => {
    logger.log("AuthActions: Signing out current user.");
    
    const { error } = await retryWithBackoff(
      () => supabase.auth.signOut(),
      {
        maxRetries: 2,
        onRetry: (attempt) => {
          logger.log(`AuthActions: Retrying sign-out (attempt ${attempt})`);
        }
      }
    );
    
    if (error) {
      logger.error("AuthActions: Sign out error:", error.message, { errorDetails: error });
      throw error;
    }
    logger.log("AuthActions: Sign out successful. Navigating to /auth.");
    navigate("/auth", { replace: true });
  }, [navigate]);

  return useMemo(() => ({
    signIn,
    signInWithPassword,
    signInWithOTP,
    verifyOTP,
    signUp,
    signOut,
  }), [signIn, signInWithPassword, signInWithOTP, verifyOTP, signUp, signOut]);
}
