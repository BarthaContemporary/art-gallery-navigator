
import { useNavigate } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithPassword = useCallback(async (email: string, password: string, captchaToken?: string) => {
    logger.log("AuthActions: Signing in with password for:", email, "Captcha token present:", !!captchaToken);
    
    // Try with captcha first if provided, then fallback without it
    const authOptions = captchaToken ? { captchaToken } : {};
    
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: authOptions,
    });
    
    if (error) {
      // If captcha-related error and we had a token, try without it
      if (captchaToken && error.message.toLowerCase().includes('captcha')) {
        logger.warn("AuthActions: Captcha failed, retrying without captcha token");
        const { error: retryError, data: retryData } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (retryError) {
          logger.error("AuthActions: Sign in retry error:", retryError.message, { email, errorDetails: retryError });
          throw retryError;
        }
        
        logger.log("AuthActions: Password sign-in successful (retry) for:", email, "Session:", retryData.session ? "Present" : "Absent");
        return;
      }
      
      logger.error("AuthActions: Sign in with password error:", error.message, { email, errorDetails: error });
      throw error;
    }
    
    logger.log("AuthActions: Password sign-in successful for:", email, "Session:", data.session ? "Present" : "Absent");
  }, []);

  const signInWithOTP = useCallback(async (email: string, captchaToken?: string) => {
    logger.log("AuthActions: Sending OTP to:", email, "Captcha token present:", !!captchaToken);
    
    // Try with captcha first if provided, then fallback without it
    const authOptions = captchaToken ? { shouldCreateUser: false, captchaToken } : { shouldCreateUser: false };
    
    const { error, data } = await supabase.auth.signInWithOtp({
      email,
      options: authOptions
    });
    
    if (error) {
      // If captcha-related error and we had a token, try without it
      if (captchaToken && error.message.toLowerCase().includes('captcha')) {
        logger.warn("AuthActions: Captcha failed for OTP, retrying without captcha token");
        const { error: retryError, data: retryData } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false }
        });
        
        if (retryError) {
          logger.error("AuthActions: OTP retry error:", retryError.message, { email, errorDetails: retryError });
          throw retryError;
        }
        
        logger.log("AuthActions: OTP sent successfully (retry) to:", email, "Data:", retryData);
        return { needsOTP: true };
      }
      
      logger.error("AuthActions: Sign in with OTP error:", error.message, { email, errorDetails: error });
      throw error;
    }
    
    logger.log("AuthActions: OTP sent successfully to:", email, "Data:", data);
    return { needsOTP: true };
  }, []);
  
  const signIn = useCallback(async (email: string, password?: string, captchaToken?: string) => {
    logger.log("AuthActions: Unified sign-in attempt for:", email, "Password provided:", !!password, "Captcha token present:", !!captchaToken);
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
    const { error, data } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) {
      logger.error("AuthActions: OTP verification error:", error.message, { email, errorDetails: error });
      throw error;
    }
    logger.log("AuthActions: OTP verification successful for:", email, "Session:", data.session ? "Present" : "Absent");
  }, []);

  const signUp = useCallback(async (email: string, password: string, captchaToken?: string) => {
    logger.log("AuthActions: Signing up user:", email, "Captcha token present:", !!captchaToken);
    
    // Try with captcha first if provided, then fallback without it
    const authOptions = captchaToken ? { captchaToken } : {};
    
    const { error, data } = await supabase.auth.signUp({ 
      email, 
      password,
      options: authOptions
    });
    
    if (error) {
      // If captcha-related error and we had a token, try without it
      if (captchaToken && error.message.toLowerCase().includes('captcha')) {
        logger.warn("AuthActions: Captcha failed for signup, retrying without captcha token");
        const { error: retryError, data: retryData } = await supabase.auth.signUp({ 
          email, 
          password
        });
        
        if (retryError) {
          logger.error("AuthActions: Signup retry error:", retryError.message, { email, errorDetails: retryError });
          throw retryError;
        }
        
        logger.log("AuthActions: Sign up successful (retry) for:", email, "User created:", !!retryData.user, "Session provided:", !!retryData.session);
        return;
      }
      
      logger.error("AuthActions: Sign up error:", error.message, { email, errorDetails: error });
      throw error;
    }
    
    logger.log("AuthActions: Sign up successful for:", email, "User created:", !!data.user, "Session provided:", !!data.session);
  }, []);

  const signOut = useCallback(async () => {
    logger.log("AuthActions: Signing out current user.");
    const { error } = await supabase.auth.signOut();
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
