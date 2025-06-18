
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { AlertCircle, Loader2 } from "lucide-react";

const requestPasswordResetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type RequestPasswordResetFormValues = z.infer<typeof requestPasswordResetSchema>;

// Fallback site key as specified in custom instructions
const FALLBACK_TURNSTILE_SITE_KEY = "0x4AAAAAABVNY-RtAZWQwtdF";
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || FALLBACK_TURNSTILE_SITE_KEY;

interface PasswordResetFormProps {
  onSubmit: (values: RequestPasswordResetFormValues, captchaToken: string | null) => Promise<void>;
  isLoading: boolean;
  formError: string | null;
}

export function PasswordResetForm({ onSubmit, isLoading, formError }: PasswordResetFormProps) {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const form = useForm<RequestPasswordResetFormValues>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleCaptchaVerify = (token: string) => {
    console.log('Password reset form - CAPTCHA verified:', token ? 'success' : 'failed');
    setCaptchaToken(token);
    setCaptchaError(null);
  };

  const handleSubmit = async (values: RequestPasswordResetFormValues) => {
    console.log('Password reset form - Submit attempt:', {
      email: values.email,
      captchaToken: captchaToken ? 'present' : 'missing',
      siteKey: TURNSTILE_SITE_KEY ? 'configured' : 'missing'
    });
    
    if (!TURNSTILE_SITE_KEY) {
      setCaptchaError("CAPTCHA configuration error. Please contact support.");
      return;
    }
    if (!captchaToken) {
      setCaptchaError("Please complete the CAPTCHA challenge.");
      return;
    }

    await onSubmit(values, captchaToken);
  };

  return (
    <>
      {formError && (
        <div className="mb-4 flex items-center text-sm text-red-600 dark:text-red-400 p-3 bg-red-50 dark:bg-red-900/30 rounded-md">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          <span>{formError}</span>
        </div>
      )}

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
                    placeholder="Enter your email"
                    autoFocus
                    className="text-base sm:text-sm py-3"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-center">
            <TurnstileWidget
              onVerify={handleCaptchaVerify}
            />
          </div>
          
          {captchaError && (
            <div className="flex items-center text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/30 rounded-md">
              <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>{captchaError}</span>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-12 sm:h-10 text-lg sm:text-base" 
            disabled={isLoading || !captchaToken || !form.formState.isValid}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Reset Link...
              </>
            ) : "Send Reset Link"}
          </Button>
        </form>
      </Form>
    </>
  );
}
