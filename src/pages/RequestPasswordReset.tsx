
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card } from "@/components/ui/card";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const requestPasswordResetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type RequestPasswordResetFormValues = z.infer<typeof requestPasswordResetSchema>;

// Re-use the hardcoded Turnstile Site Key from LoginForm or define it globally.
// For simplicity here, we'll re-declare it. Ideally, this comes from env vars or a config file.
const TURNSTILE_SITE_KEY = "0x4AAAAAABVNY-RtAZWQwtdF"; 

export default function RequestPasswordResetPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const form = useForm<RequestPasswordResetFormValues>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
        logger.error("Critical: Turnstile Site Key is missing for password reset. CAPTCHA will not function.");
        setCaptchaError("CAPTCHA configuration error. Please contact support.");
    }
  }, []);

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
    setCaptchaError(null);
  };

  const handleCaptchaError = () => {
    setCaptchaError("CAPTCHA challenge failed. Please try again.");
    setCaptchaToken(null);
  };

  const handleCaptchaExpire = () => {
    setCaptchaError("CAPTCHA challenge expired. Please complete it again.");
    setCaptchaToken(null);
  };

  const onSubmit = async (values: RequestPasswordResetFormValues) => {
    if (!TURNSTILE_SITE_KEY) {
      setFormError("CAPTCHA configuration error. Please contact support.");
      return;
    }
    if (!captchaToken) {
      setCaptchaError("Please complete the CAPTCHA challenge.");
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/update-password`,
        captchaToken: captchaToken,
      });

      if (error) {
        logger.error("Password reset request error:", error.message, { email: values.email, errorDetails: error });
        setFormError(error.message || "Failed to send password reset email. Please try again.");
        if (error.message.toLowerCase().includes("captcha")) {
          setCaptchaError("CAPTCHA verification failed with server. Please try again.");
          setCaptchaToken(null); // Reset captcha token
        }
      } else {
        logger.log("Password reset email sent successfully to:", values.email);
        setIsSuccess(true);
        toast({
          title: "Check your email",
          description: `A password reset link has been sent to ${values.email}.`,
        });
      }
    } catch (error: any) {
      logger.error("Unexpected password reset request error:", error.message, { email: values.email });
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md p-6 shadow-lg text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Password Reset Email Sent</h1>
          <p className="text-muted-foreground mb-6">
            If an account exists for the email address you provided, a password reset link has been sent. Please check your inbox (and spam folder).
          </p>
          <Button onClick={() => navigate("/auth")} className="w-full">
            Back to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>

        {formError && (
          <div className="mb-4 flex items-center text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/30 rounded-md">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Enter your email"
                      autoFocus
                      className="text-base sm:text-sm py-3"
                      disabled={isLoading || !TURNSTILE_SITE_KEY}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <TurnstileWidget
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={handleCaptchaVerify}
                  onError={handleCaptchaError}
                  onExpire={handleCaptchaExpire}
                  theme="light"
                />
              </div>
            )}
            
            {captchaError && (
              <div className="flex items-center text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/30 rounded-md">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>{captchaError}</span>
              </div>
            )}

            <Button type="submit" className="w-full h-12 sm:h-10 text-lg sm:text-base" disabled={isLoading || !captchaToken || !TURNSTILE_SITE_KEY}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : "Send Reset Link"}
            </Button>
          </form>
        </Form>
        <div className="mt-6 text-center text-sm">
          <Link to="/auth" className="text-primary hover:underline">
            Back to Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
