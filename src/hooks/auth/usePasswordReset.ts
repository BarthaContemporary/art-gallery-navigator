
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "@/components/ui/use-toast";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAABVNY-RtAZWQwtdF";

interface RequestPasswordResetFormValues {
  email: string;
}

export function usePasswordReset() {
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      logger.error("Critical: Turnstile Site Key is missing for password reset. CAPTCHA will not function.");
    }
  }, []);

  const submitPasswordReset = async (values: RequestPasswordResetFormValues, captchaToken: string | null) => {
    if (!TURNSTILE_SITE_KEY) {
      setFormError("CAPTCHA configuration error. Please contact support.");
      return;
    }
    if (!captchaToken) {
      return;
    }

    setIsLoading(true);
    setFormError(null);
    setSubmittedEmail(values.email);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/update-password`,
        captchaToken: captchaToken,
      });

      if (error) {
        logger.error("Password reset request error:", error.message, { email: values.email, errorDetails: error });
        let userFriendlyError = "Failed to send password reset email. Please check the email address and try again.";
        if (error.message.toLowerCase().includes("captcha")) {
          userFriendlyError = "CAPTCHA verification failed. Please try the CAPTCHA again.";
        } else if (error.message.toLowerCase().includes("user not found") || error.message.toLowerCase().includes("no user found")) {
          logger.log("Password reset requested for non-existent email (standard behavior):", values.email);
          setIsSuccess(true); 
          toast({
            title: "Check Your Email",
            description: `If an account exists for ${values.email}, a password reset link has been sent. Please check your inbox (and spam folder).`,
          });
          return;
        }
        setFormError(userFriendlyError);
      } else {
        logger.log("Password reset email sent successfully to:", values.email);
        setIsSuccess(true);
        toast({
          title: "Check Your Email",
          description: `A password reset link has been sent to ${values.email}. Please check your inbox (and spam folder). It might take a few minutes for the email to arrive.`,
          className: "bg-green-500 text-white",
        });
      }
    } catch (error: any) {
      logger.error("Unexpected password reset request error:", error.message, { email: values.email });
      setFormError("An unexpected error occurred. Please try again or contact support if the issue persists.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate("/auth");
  };

  return {
    isLoading,
    formError,
    isSuccess,
    submittedEmail,
    submitPasswordReset,
    handleBackToLogin,
  };
}
