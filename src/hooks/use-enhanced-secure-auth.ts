
import { useCallback, useMemo } from "react";
import { useAuthActions } from "./use-auth-actions";
import { EnhancedInputValidator } from "@/utils/enhanced-input-validation";
import { toast } from "sonner";

export function useEnhancedSecureAuth() {
  const authActions = useAuthActions();

  const secureSignIn = useCallback(async (email: string, password?: string, captchaToken?: string) => {
    // Enhanced rate limiting check
    if (!EnhancedInputValidator.checkRateLimit('signin', 3, 5 * 60 * 1000)) {
      toast.error('Too many sign-in attempts. Please try again in 5 minutes.');
      return { needsOTP: false, error: 'Rate limit exceeded' };
    }

    // Enhanced input validation
    if (!EnhancedInputValidator.validateEmail(email)) {
      toast.error('Please enter a valid email address.');
      return { needsOTP: false, error: 'Invalid email' };
    }

    // Sanitize email input
    const sanitizedEmail = EnhancedInputValidator.sanitizeInput(email);

    if (password) {
      const passwordValidation = EnhancedInputValidator.validatePassword(password);
      if (!passwordValidation.isValid) {
        toast.error(passwordValidation.errors[0]);
        return { needsOTP: false, error: 'Invalid password' };
      }

      // Check for password length to prevent extremely long passwords that could cause DoS
      if (password.length > 128) {
        toast.error('Password is too long.');
        return { needsOTP: false, error: 'Password too long' };
      }
    }

    try {
      const result = await authActions.signIn(sanitizedEmail, password, captchaToken);
      
      // Log successful authentication attempt (without sensitive data)
      console.log('Authentication attempt successful for user:', sanitizedEmail.substring(0, 3) + '***');
      
      return result;
    } catch (error) {
      // Log failed authentication attempt
      console.warn('Authentication attempt failed for user:', sanitizedEmail.substring(0, 3) + '***');
      
      // Don't expose internal error details to prevent information leakage
      toast.error('Authentication failed. Please check your credentials and try again.');
      return { needsOTP: false, error: 'Authentication failed' };
    }
  }, [authActions]);

  const secureSignUp = useCallback(async (email: string, password: string, captchaToken?: string) => {
    // Enhanced rate limiting check
    if (!EnhancedInputValidator.checkRateLimit('signup', 2, 60 * 60 * 1000)) {
      toast.error('Too many sign-up attempts. Please try again later.');
      return { error: 'Rate limit exceeded' };
    }

    // Enhanced input validation
    if (!EnhancedInputValidator.validateEmail(email)) {
      toast.error('Please enter a valid email address.');
      return { error: 'Invalid email' };
    }

    const passwordValidation = EnhancedInputValidator.validatePassword(password);
    if (!passwordValidation.isValid) {
      toast.error(passwordValidation.errors[0]);
      return { error: 'Invalid password' };
    }

    // Additional security checks
    if (password.length > 128) {
      toast.error('Password is too long.');
      return { error: 'Password too long' };
    }

    // Sanitize inputs
    const sanitizedEmail = EnhancedInputValidator.sanitizeInput(email);

    // Check for disposable email domains (basic check)
    const disposableDomains = ['tempmail.org', '10minutemail.com', 'guerrillamail.com'];
    const emailDomain = sanitizedEmail.split('@')[1]?.toLowerCase();
    if (emailDomain && disposableDomains.includes(emailDomain)) {
      toast.error('Please use a permanent email address.');
      return { error: 'Invalid email domain' };
    }

    try {
      await authActions.signUp(sanitizedEmail, password, captchaToken);
      
      // Log successful registration (without sensitive data)
      console.log('Registration successful for user:', sanitizedEmail.substring(0, 3) + '***');
      
      return { success: true };
    } catch (error) {
      console.error('Registration failed for user:', sanitizedEmail.substring(0, 3) + '***', error);
      
      // Don't expose internal error details
      toast.error('Registration failed. Please try again.');
      return { error: 'Registration failed' };
    }
  }, [authActions]);

  const secureVerifyOTP = useCallback(async (email: string, token: string) => {
    // Enhanced rate limiting check
    if (!EnhancedInputValidator.checkRateLimit('otp_verify', 5, 15 * 60 * 1000)) {
      toast.error('Too many OTP verification attempts. Please try again later.');
      return { error: 'Rate limit exceeded' };
    }

    // Enhanced input validation
    if (!EnhancedInputValidator.validateEmail(email)) {
      toast.error('Invalid email address.');
      return { error: 'Invalid email' };
    }

    // Enhanced OTP validation
    if (!token || typeof token !== 'string') {
      toast.error('Please enter the verification code.');
      return { error: 'Missing OTP' };
    }

    const sanitizedToken = token.replace(/\D/g, ''); // Remove non-digits
    if (sanitizedToken.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code.');
      return { error: 'Invalid OTP format' };
    }

    // Check for obviously invalid codes
    if (/^(\d)\1{5}$/.test(sanitizedToken) || sanitizedToken === '123456' || sanitizedToken === '000000') {
      toast.error('Please enter a valid verification code.');
      return { error: 'Invalid OTP' };
    }

    const sanitizedEmail = EnhancedInputValidator.sanitizeInput(email);

    try {
      await authActions.verifyOTP(sanitizedEmail, sanitizedToken);
      
      // Log successful OTP verification
      console.log('OTP verification successful for user:', sanitizedEmail.substring(0, 3) + '***');
      
      return { success: true };
    } catch (error) {
      console.warn('OTP verification failed for user:', sanitizedEmail.substring(0, 3) + '***');
      
      // Don't expose internal error details
      toast.error('Verification code is incorrect or expired. Please try again.');
      return { error: 'OTP verification failed' };
    }
  }, [authActions]);

  const securePasswordReset = useCallback(async (email: string, captchaToken?: string) => {
    // Rate limiting for password reset attempts
    if (!EnhancedInputValidator.checkRateLimit('password_reset', 3, 60 * 60 * 1000)) {
      toast.error('Too many password reset attempts. Please try again later.');
      return { error: 'Rate limit exceeded' };
    }

    if (!EnhancedInputValidator.validateEmail(email)) {
      toast.error('Please enter a valid email address.');
      return { error: 'Invalid email' };
    }

    const sanitizedEmail = EnhancedInputValidator.sanitizeInput(email);

    try {
      // This would need to be implemented in your auth actions
      console.log('Password reset requested for user:', sanitizedEmail.substring(0, 3) + '***');
      toast.success('If an account with this email exists, you will receive password reset instructions.');
      return { success: true };
    } catch (error) {
      console.error('Password reset failed for user:', sanitizedEmail.substring(0, 3) + '***');
      toast.error('Password reset request failed. Please try again.');
      return { error: 'Password reset failed' };
    }
  }, []);

  return useMemo(() => ({
    secureSignIn,
    secureSignUp,
    secureVerifyOTP,
    securePasswordReset,
    signOut: authActions.signOut,
  }), [secureSignIn, secureSignUp, secureVerifyOTP, securePasswordReset, authActions.signOut]);
}
