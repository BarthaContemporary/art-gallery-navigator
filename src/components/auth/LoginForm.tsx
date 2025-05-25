
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget"; // Added import
import { logger } from "@/lib/logger"; // Added import

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

// Attempt to get the Turnstile Site Key from environment variables
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export function LoginForm({ onSubmit, isLoading, onOtpRequested, onError }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [isSiteKeyAvailable, setIsSiteKeyAvailable] = useState(false);

  useEffect(() => {
    if (TURNSTILE_SITE_KEY) {
      logger.log("Turnstile Site Key found.");
      setIsSiteKeyAvailable(true);
    } else {
      logger.warn("VITE_TURNSTILE_SITE_KEY is not set. CAPTCHA will not be rendered.");
      setIsSiteKeyAvailable(false);
      setCaptchaError("CAPTCHA configuration is missing. Login is disabled.");
    }
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const handleCaptchaVerify = (token: string) => {
    logger.log("CAPTCHA verified successfully.");
    setCaptchaToken(token);
    setCaptchaError(null);
  };

  const handleCaptchaError = (error: Error) => {
    logger.error("CAPTCHA verification error:", error.message);
    setCaptchaError(`CAPTCHA error: ${error.message}. Please try again.`);
    setCaptchaToken(null); // Ensure token is null on error
    if (onError) onError(error);
  };

  const handleSubmit = (values: LoginFormValues) => {
    if (!captchaToken) {
      logger.error("Attempted to submit login form without CAPTCHA token.");
      // This case should ideally be prevented by button's disabled state
      setCaptchaError("CAPTCHA verification is required. Please complete the CAPTCHA.");
      return;
    }
    onSubmit(values, captchaToken);
  };

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
                  disabled={isLoading || !isSiteKeyAvailable}
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
                    disabled={isLoading || !isSiteKeyAvailable}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    tabIndex={-1}
                    disabled={!isSiteKeyAvailable}
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

        {isSiteKeyAvailable ? (
          <TurnstileWidget
            siteKey={TURNSTILE_SITE_KEY!} // Assert non-null as it's checked by isSiteKeyAvailable
            onVerify={handleCaptchaVerify}
            onError={handleCaptchaError}
          />
        ) : null}
        
        {captchaError && (
          <p className="text-center text-sm text-destructive mt-2">{captchaError}</p>
        )}
        
        <Button 
          type="submit" 
          className="w-full h-12 sm:h-10 text-lg sm:text-base"
          disabled={isLoading || !form.formState.isValid || !captchaToken || !isSiteKeyAvailable}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : "Login"}
        </Button>
      </form>
    </Form>
  );
}
