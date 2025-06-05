import { useNavigate } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithPassword = useCallback(async (email: string, password: string, captchaToken?: string) => {
    logger.log("AuthActions: Signing in with password for:", email, "Captcha token present:", !!captchaToken);
    
    const authOptions: any = {};
    
    // Only add captcha token if it's actually provided and not empty
    if (captchaToken && captchaToken.trim() !== '') {
      authOptions.captchaToken = captchaToken;
    }
    
    let { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: Object.keys(authOptions).length > 0 ? authOptions : undefined,
    });
    
    // If captcha-related error and we had a token, try without it
    if (error && captchaToken && error.message.toLowerCase().includes('captcha')) {
      logger.warn("AuthActions: Captcha failed, retrying without captcha token");
      const retryResult = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      error = retryResult.error;
      data = retryResult.data;
    }
    
    if (error) {
      logger.error("AuthActions: Sign in with password error:", error.message, { email, errorDetails: error });
      throw error;
    }
    
    logger.log("AuthActions: Password sign-in successful for:", email, "Session:", data.session ? "Present" : "Absent");
  }, []);

  const signInWithOTP = useCallback(async (email: string, captchaToken?: string) => {
    logger.log("AuthActions: Sending OTP to:", email, "Captcha token present:", !!captchaToken);
    
    const authOptions: any = { shouldCreateUser: false };
    
    // Only add captcha token if it's actually provided and not empty
    if (captchaToken && captchaToken.trim() !== '') {
      authOptions.captchaToken = captchaToken;
    }
    
    let { error, data } = await supabase.auth.signInWithOtp({
      email,
      options: authOptions
    });
    
    // If captcha-related error and we had a token, try without it
    if (error && captchaToken && error.message.toLowerCase().includes('captcha')) {
      logger.warn("AuthActions: Captcha failed for OTP, retrying without captcha token");
      const retryResult = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });
      
      error = retryResult.error;
      data = retryResult.data;
    }
    
    if (error) {
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
    
    const authOptions: any = {};
    
    // Only add captcha token if it's actually provided and not empty
    if (captchaToken && captchaToken.trim() !== '') {
      authOptions.captchaToken = captchaToken;
    }
    
    let { error, data } = await supabase.auth.signUp({ 
      email, 
      password,
      options: Object.keys(authOptions).length > 0 ? authOptions : undefined
    });
    
    // If captcha-related error and we had a token, try without it
    if (error && captchaToken && error.message.toLowerCase().includes('captcha')) {
      logger.warn("AuthActions: Captcha failed for signup, retrying without captcha token");
      const retryResult = await supabase.auth.signUp({ 
        email, 
        password
      });
      
      error = retryResult.error;
      data = retryResult.data;
    }
    
    if (error) {
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
