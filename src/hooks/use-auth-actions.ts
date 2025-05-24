
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// This hook will return the action functions.
// It needs to be callable within the AuthProvider component.
// So it should be a hook that uses useNavigate.

export function useAuthActions() {
  const navigate = useNavigate();

  const signInWithPassword = async (email: string, password: string, captchaToken?: string) => {
    console.log("Signing in with password:", email, "CAPTCHA token provided:", !!captchaToken);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined
    });
    if (error) {
      console.error("Sign in with password error:", error);
      throw error;
    }
    console.log("Password sign-in successful");
  };

  const signInWithOTP = async (email: string, captchaToken?: string) => {
    console.log("Sending OTP to:", email, "CAPTCHA token provided:", !!captchaToken);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        captchaToken: captchaToken
      }
    });
    if (error) {
      console.error("Sign in with OTP error:", error);
      throw error;
    }
    console.log("OTP sent successfully");
    return { needsOTP: true };
  };
  
  const signIn = async (email: string, password: string, captchaToken?: string) => {
    console.log("Signing in with:", email, "CAPTCHA token provided:", !!captchaToken);
    if (password) {
      try {
        await signInWithPassword(email, password, captchaToken);
        return { needsOTP: false };
      } catch (error) {
        console.error("Password login failed:", error);
        if (error instanceof Error && (error.message.includes("Invalid login credentials") || captchaToken === "development-mode")) {
          return signInWithOTP(email, captchaToken);
        }
        throw error;
      }
    } else {
      return signInWithOTP(email, captchaToken);
    }
  };

  const verifyOTP = async (email: string, token: string) => {
    console.log("Verifying OTP for:", email);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) {
      console.error("OTP verification error:", error);
      throw error;
    }
    console.log("OTP verification successful");
    navigate("/");
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("Sign up error:", error);
      throw error;
    }
    console.log("Sign up successful");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
      throw error;
    }
    console.log("Sign out successful");
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
