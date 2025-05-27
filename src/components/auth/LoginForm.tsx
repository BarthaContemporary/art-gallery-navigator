import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { logger } from "@/lib/logger";
import { TurnstileWidget } from "./TurnstileWidget";
import { Link } from "react-router-dom";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().optional()
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (values: LoginFormValues, captchaToken: string) => void;
  isLoading: boolean;
  onOtpRequested?: (userEmail: string) => void;
  onError?: (error: Error) => void;
}

// Hardcode the Turnstile Site Key
const TURNSTILE_SITE_KEY = "0x4AAAAAABVNY-RtAZWQwtdF";

export function LoginForm({ onSubmit, isLoading, onOtpRequested, onError }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // Determine configuration status based on the hardcoded key.
  // This will be true if TURNSTILE_SITE_KEY is a non-empty string.
  const isSiteKeyEffectivelyConfigured = !!TURNSTILE_SITE_KEY && TURNSTILE_SITE_KEY.length > 0;

  useEffect(() => {
    if (isSiteKeyEffectivelyConfigured) {
      logger.log("Using hardcoded Turnstile Site Key:", TURNSTILE_SITE_KEY);
    } else {
      // This branch should ideally not be hit if TURNSTILE_SITE_KEY is correctly hardcoded.
      logger.error("Hardcoded Turnstile Site Key is empty. CAPTCHA will not be displayed.");
      setCaptchaError("CAPTCHA configuration error: Site key not configured. Please contact support.");
    }
  }, [isSiteKeyEffectivelyConfigured, setCaptchaError]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const handleCaptchaVerify = useCallback((token: string) => {
    logger.log("CAPTCHA verified in LoginForm, token received.");
    setCaptchaToken(token);
    setCaptchaError(null); 
  }, []);

  const handleCaptchaError = useCallback(() => {
    logger.error("CAPTCHA error in LoginForm callback.");
    setCaptchaError("CAPTCHA challenge failed. Please try again or refresh the page.");
    setCaptchaToken(null); 
    if (onError) onError(new Error("CAPTCHA challenge failed."));
  }, [onError]);

  const handleCaptchaExpire = useCallback(() => {
    logger.warn("CAPTCHA expired in LoginForm callback.");
    setCaptchaError("CAPTCHA challenge expired. Please complete it again.");
    setCaptchaToken(null); 
  }, []);

  const handleSubmit = useCallback((values: LoginFormValues) => {
    if (!isSiteKeyEffectivelyConfigured) {
      // This error message might need adjustment if the key is hardcoded but somehow "invalid"
      setCaptchaError("CAPTCHA configuration error. Please contact support.");
      logger.error("Login submit attempted but site key is not effectively configured (hardcoded key issue).");
      return;
    }
    if (!captchaToken) {
      setCaptchaError("Please complete the CAPTCHA challenge before logging in.");
      logger.warn("Login submit attempted without CAPTCHA token.");
      return;
    }
    logger.log("Submitting login form with CAPTCHA token.");
    onSubmit(values, captchaToken);
  }, [captchaToken, onSubmit, isSiteKeyEffectivelyConfigured, setCaptchaError]); // Added setCaptchaError

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="Email"
                  autoFocus
                  className="text-base sm:text-sm py-3"
                  inputMode="email"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    placeholder="Password (optional)"
                    className="text-base sm:text-sm py-3 pr-10"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {isSiteKeyEffectivelyConfigured ? (
          <div className="flex justify-center">
            <TurnstileWidget
              siteKey={TURNSTILE_SITE_KEY} // Use the hardcoded key
              onVerify={handleCaptchaVerify}
              onError={handleCaptchaError}
              onExpire={handleCaptchaExpire}
              theme="light"
            />
          </div>
        ) : (
           <div className="flex items-center text-sm text-red-600 dark:text-red-400 p-3 bg-red-100 dark:bg-red-900/30 rounded-md border border-red-300 dark:border-red-700">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            {/* Updated error message for clarity */}
            <span>CAPTCHA service is currently unavailable due to a site key configuration issue. Please contact support.</span>
          </div>
        )}
        
        {captchaError && (
          <div className="flex items-center text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/30 rounded-md">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <span>{captchaError}</span>
          </div>
        )}
        
        <Button 
          type="submit" 
          className="w-full h-12 sm:h-10 text-lg sm:text-base"
          disabled={isLoading || !form.formState.isValid || !captchaToken || !isSiteKeyEffectivelyConfigured}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : "Login"}
        </Button>

        <div className="text-center text-sm">
          <Link to="/request-password-reset" className="text-primary hover:underline">
            Forgot Password?
          </Link>
        </div>
      </form>
    </Form>
  );
}
