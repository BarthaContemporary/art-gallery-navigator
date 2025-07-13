
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { SecurityMonitor, logAuthEvent } from "@/utils/security-monitoring";
import { SECURITY_EVENT_TYPES } from "@/utils/security-headers";

interface CreateUserParams {
  email: string;
  password: string;
  role: "gallery_admin" | "artist" | "external";
  captchaToken: string | null;
}

interface CreateUserResult {
  success: boolean;
  error?: any;
  userId?: string;
}

export function useEnhancedUserCreation() {
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const securityMonitor = SecurityMonitor.getInstance();

  const createUser = async (params: CreateUserParams): Promise<CreateUserResult> => {
    setIsLoading(true);
    
    try {
      // Log attempt
      securityMonitor.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
        severity: 'info',
        details: {
          action: 'user_creation_attempt',
          email: params.email,
          role: params.role,
          hasCaptcha: !!params.captchaToken
        }
      });

      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          emailRedirectTo: window.location.origin + '/email-confirmation',
          captchaToken: params.captchaToken || undefined
        }
      });
      
      if (error) {
        // Log failed attempt
        securityMonitor.logSecurityEvent({
          type: SECURITY_EVENT_TYPES.LOGIN_FAILURE,
          severity: 'warning',
          details: {
            action: 'user_creation_failed',
            error: error.message,
            email: params.email,
            errorCode: error.message
          }
        });
        
        throw error;
      }
      
      const userId = data.user?.id;
      if (userId) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: userId,
          role: params.role
        });
        
        if (roleError) {
          securityMonitor.logSecurityEvent({
            type: SECURITY_EVENT_TYPES.PERMISSION_DENIED,
            severity: 'critical',
            details: {
              action: 'role_assignment_failed',
              userId,
              role: params.role,
              error: roleError.message
            }
          });
          throw roleError;
        }

        // Log successful creation
        securityMonitor.logSecurityEvent({
          type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
          severity: 'info',
          details: {
            action: 'user_creation_success',
            userId,
            email: params.email,
            role: params.role
          }
        });
      }
      
      toast({
        title: "User created successfully",
        description: `The user ${params.email} was created with role ${params.role}.`,
        variant: "default"
      });
      
      setRetryCount(0);
      return { success: true, userId };
      
    } catch (error: any) {
      logger.error("User creation error:", error);
      
      return { 
        success: false, 
        error: {
          ...error,
          timestamp: new Date().toISOString(),
          retryCount
        }
      };
    } finally {
      setIsLoading(false);
    }
  };

  const retryCreateUser = async (params: CreateUserParams): Promise<CreateUserResult> => {
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    securityMonitor.logSecurityEvent({
      type: SECURITY_EVENT_TYPES.LOGIN_FAILURE,
      severity: 'warning',
      details: {
        action: 'user_creation_retry',
        email: params.email,
        retryCount: newRetryCount
      }
    });

    // Try without CAPTCHA on retry (fallback method)
    return createUser({
      ...params,
      captchaToken: null
    });
  };

  const sendManualActivation = async (userEmail: string): Promise<boolean> => {
    try {
      securityMonitor.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
        severity: 'info',
        details: {
          action: 'manual_activation_attempt',
          email: userEmail
        }
      });

      const { error } = await supabase.functions.invoke('admin-send-password-reset', {
        body: { 
          targetUserEmail: userEmail, 
          appBaseUrl: window.location.origin,
          isManualActivation: true
        }
      });

      if (error) {
        securityMonitor.logSecurityEvent({
          type: SECURITY_EVENT_TYPES.LOGIN_FAILURE,
          severity: 'warning',
          details: {
            action: 'manual_activation_failed',
            email: userEmail,
            error: error.message
          }
        });
        throw error;
      }
      
      securityMonitor.logSecurityEvent({
        type: SECURITY_EVENT_TYPES.LOGIN_SUCCESS,
        severity: 'info',
        details: {
          action: 'manual_activation_success',
          email: userEmail
        }
      });

      toast({
        title: "Manual activation sent",
        description: `An activation email has been sent to ${userEmail}.`,
        variant: "default"
      });
      
      return true;
    } catch (error: any) {
      logger.error("Manual activation error:", error);
      
      toast({
        title: "Manual activation failed",
        description: error.message || "Failed to send manual activation email",
        variant: "destructive"
      });
      
      return false;
    }
  };

  return {
    createUser,
    retryCreateUser,
    sendManualActivation,
    isLoading,
    retryCount
  };
}
