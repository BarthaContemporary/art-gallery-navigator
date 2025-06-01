
import { useCallback, useMemo } from "react";
import { useAuthActions } from "./use-auth-actions";
import { InputValidator } from "@/utils/input-validation";
import { toast } from "sonner";

export function useSecureAuth() {
  const authActions = useAuthActions();

  const secureSignIn = useCallback(async (email: string, password?: string, captchaToken?: string) => {
    // Rate limiting check
    if (!InputValidator.checkRateLimit('signin', 5, 5 * 60 * 1000)) { // 5 attempts per 5 minutes
      toast.error('Too many sign-in attempts. Please try again later.');
      return { needsOTP: false, error: 'Rate limit exceeded' };
    }

    // Input validation
    if (!InputValidator.validateEmail(email)) {
      toast.error('Please enter a valid email address.');
      return { needsOTP: false, error: 'Invalid email' };
    }

    if (password) {
      const passwordValidation = InputValidator.validatePassword(password);
      if (!passwordValidation.isValid) {
        toast.error(passwordValidation.errors[0]);
        return { needsOTP: false, error: 'Invalid password' };
      }
    }

    try {
      return await authActions.signIn(email, password, captchaToken);
    } catch (error) {
      console.error('Secure sign-in error:', error);
      toast.error('Sign-in failed. Please try again.');
      return { needsOTP: false, error: 'Sign-in failed' };
    }
  }, [authActions]);

  const secureSignUp = useCallback(async (email: string, password: string, captchaToken?: string) => {
    // Rate limiting check
    if (!InputValidator.checkRateLimit('signup', 3, 60 * 60 * 1000)) { // 3 attempts per hour
      toast.error('Too many sign-up attempts. Please try again later.');
      return { error: 'Rate limit exceeded' };
    }

    // Input validation
    if (!InputValidator.validateEmail(email)) {
      toast.error('Please enter a valid email address.');
      return { error: 'Invalid email' };
    }

    const passwordValidation = InputValidator.validatePassword(password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.errors[0]);
      return { error: 'Invalid password' };
    }

    try {
      await authActions.signUp(email, password, captchaToken);
      return { success: true };
    } catch (error) {
      console.error('Secure sign-up error:', error);
      toast.error('Sign-up failed. Please try again.');
      return { error: 'Sign-up failed' };
    }
  }, [authActions]);

  const secureVerifyOTP = useCallback(async (email: string, token: string) => {
    // Rate limiting check
    if (!InputValidator.checkRateLimit('otp_verify', 5, 15 * 60 * 1000)) { // 5 attempts per 15 minutes
      toast.error('Too many OTP verification attempts. Please try again later.');
      return { error: 'Rate limit exceeded' };
    }

    // Input validation
    if (!InputValidator.validateEmail(email)) {
      toast.error('Invalid email address.');
      return { error: 'Invalid email' };
    }

    if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
      toast.error('Please enter a valid 6-digit verification code.');
      return { error: 'Invalid OTP' };
    }

    try {
      await authActions.verifyOTP(email, token);
      return { success: true };
    } catch (error) {
      console.error('Secure OTP verification error:', error);
      toast.error('OTP verification failed. Please try again.');
      return { error: 'OTP verification failed' };
    }
  }, [authActions]);

  return useMemo(() => ({
    secureSignIn,
    secureSignUp,
    secureVerifyOTP,
    signOut: authActions.signOut,
  }), [secureSignIn, secureSignUp, secureVerifyOTP, authActions.signOut]);
}
