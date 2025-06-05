
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

interface UserCreationError {
  type: 'email' | 'captcha' | 'network' | 'unknown';
  message: string;
  canRetry: boolean;
  suggestedAction?: string;
}

interface CreateUserParams {
  email: string;
  password: string;
  role: "gallery_admin" | "artist" | "external";
  captchaToken: string | null;
}

interface CreateUserResult {
  success: boolean;
  userId?: string;
  error?: UserCreationError;
  emailSent?: boolean;
}

export function useEnhancedUserCreation() {
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const parseSupabaseError = useCallback((error: any): UserCreationError => {
    const errorMessage = error.message?.toLowerCase() || '';
    
    // Email delivery errors
    if (errorMessage.includes('error sending confirmation email') || 
        errorMessage.includes('eof') || 
        errorMessage.includes('email')) {
      return {
        type: 'email',
        message: 'Failed to send confirmation email. The user account was created but email delivery failed.',
        canRetry: true,
        suggestedAction: 'Try manual activation or check your email configuration in Supabase.'
      };
    }
    
    // CAPTCHA errors
    if (errorMessage.includes('captcha') || 
        errorMessage.includes('timeout-or-duplicate')) {
      return {
        type: 'captcha',
        message: 'CAPTCHA verification failed or expired.',
        canRetry: true,
        suggestedAction: 'Refresh the page to get a new CAPTCHA token and try again.'
      };
    }
    
    // Network/timeout errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') || 
        errorMessage.includes('fetch')) {
      return {
        type: 'network',
        message: 'Network connection error occurred.',
        canRetry: true,
        suggestedAction: 'Check your internet connection and try again.'
      };
    }
    
    // Generic error
    return {
      type: 'unknown',
      message: error.message || 'An unknown error occurred during user creation.',
      canRetry: true,
      suggestedAction: 'Please try again or contact support if the issue persists.'
    };
  }, []);

  const createUserWithRetry = useCallback(async (params: CreateUserParams): Promise<CreateUserResult> => {
    const { email, password, role, captchaToken } = params;
    
    try {
      logger.log("Enhanced user creation: Starting user creation for:", email, "Retry count:", retryCount);
      
      // Attempt user creation with current parameters
      const signupOptions: any = {
        emailRedirectTo: window.location.origin + '/email-confirmation'
      };
      
      // Only add CAPTCHA token if provided and not on retry after CAPTCHA failure
      if (captchaToken && retryCount === 0) {
        signupOptions.captchaToken = captchaToken;
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: signupOptions
      });
      
      if (error) {
        logger.error("Enhanced user creation: Signup error:", error);
        throw error;
      }
      
      const userId = data.user?.id;
      if (!userId) {
        throw new Error("User creation succeeded but no user ID returned");
      }
      
      // Assign role
      const { error: roleError } = await supabase.from("user_roles").insert({
        user_id: userId,
        role
      });
      
      if (roleError) {
        logger.error("Enhanced user creation: Role assignment error:", roleError);
        throw roleError;
      }
      
      logger.log("Enhanced user creation: Success for:", email, "User ID:", userId);
      
      return {
        success: true,
        userId,
        emailSent: true
      };
      
    } catch (error: any) {
      logger.error("Enhanced user creation: Error creating user:", error);
      
      const parsedError = parseSupabaseError(error);
      
      // For email errors, the user might still be created successfully
      if (parsedError.type === 'email') {
        // Check if user actually exists
        try {
          const { data: usersData } = await supabase.auth.admin.listUsers();
          const userExists = usersData.users?.find((u: any) => u.email === email);
          
          if (userExists) {
            logger.log("Enhanced user creation: User exists despite email error, attempting role assignment");
            
            // Try to assign role if user exists
            try {
              const { error: roleError } = await supabase.from("user_roles").insert({
                user_id: userExists.id,
                role
              });
              
              if (!roleError) {
                return {
                  success: true,
                  userId: userExists.id,
                  emailSent: false,
                  error: parsedError
                };
              }
            } catch (roleError) {
              logger.error("Enhanced user creation: Role assignment failed after email error:", roleError);
            }
          }
        } catch (checkError) {
          logger.error("Enhanced user creation: Failed to check if user exists:", checkError);
        }
      }
      
      return {
        success: false,
        error: parsedError
      };
    }
  }, [retryCount, parseSupabaseError]);

  const createUser = useCallback(async (params: CreateUserParams): Promise<CreateUserResult> => {
    setIsLoading(true);
    setRetryCount(0);
    
    try {
      const result = await createUserWithRetry(params);
      
      if (result.success) {
        toast({
          title: "User created successfully",
          description: result.emailSent 
            ? `User ${params.email} was created and confirmation email sent.`
            : `User ${params.email} was created but confirmation email failed. You may need to manually activate them.`,
          variant: result.emailSent ? "default" : "default"
        });
        setRetryCount(0);
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [createUserWithRetry, toast]);

  const retryCreateUser = useCallback(async (params: CreateUserParams): Promise<CreateUserResult> => {
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    
    try {
      logger.log("Enhanced user creation: Retrying user creation, attempt:", retryCount + 1);
      
      // For retries, try without CAPTCHA token if it was a CAPTCHA error
      const retryParams = { ...params };
      if (retryCount > 0) {
        retryParams.captchaToken = null;
      }
      
      const result = await createUserWithRetry(retryParams);
      
      if (result.success) {
        toast({
          title: "User created successfully",
          description: `User ${params.email} was created on retry attempt ${retryCount + 1}.`,
          variant: "default"
        });
        setRetryCount(0);
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [createUserWithRetry, retryCount, toast]);

  const sendManualActivation = useCallback(async (email: string): Promise<boolean> => {
    try {
      logger.log("Enhanced user creation: Sending manual activation for:", email);
      
      const { error } = await supabase.functions.invoke('admin-send-password-reset', {
        body: { 
          targetUserEmail: email, 
          appBaseUrl: window.location.origin 
        }
      });

      if (error) {
        logger.error("Enhanced user creation: Manual activation error:", error);
        toast({
          title: "Manual activation failed",
          description: error.message || "Failed to send manual activation email",
          variant: "destructive"
        });
        return false;
      }
      
      toast({
        title: "Manual activation sent",
        description: `Manual activation email sent to ${email}`,
        variant: "default"
      });
      
      return true;
    } catch (error: any) {
      logger.error("Enhanced user creation: Manual activation error:", error);
      toast({
        title: "Manual activation failed",
        description: "Failed to send manual activation email",
        variant: "destructive"
      });
      return false;
    }
  }, [toast]);

  return {
    createUser,
    retryCreateUser,
    sendManualActivation,
    isLoading,
    retryCount
  };
}
