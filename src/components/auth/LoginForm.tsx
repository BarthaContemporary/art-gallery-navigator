import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { TurnstileWidget } from "./TurnstileWidget";
import { supabase } from "@/integrations/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password")
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onSubmit: (values: LoginFormValues, captchaToken: string) => void;
  isLoading: boolean;
}

export function LoginForm({ onSubmit, isLoading }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const handleSubmit = async (values: LoginFormValues) => {
    if (!captchaToken) {
      setCaptchaError("Please complete the CAPTCHA verification");
      return;
    }

    try {
      onSubmit(values, captchaToken);
    } catch (error) {
      console.error('Login error:', error);
      setCaptchaError("An error occurred during login. Please try again.");
    }
  };

  const handleCaptchaVerify = (token: string) => {
    console.log('CAPTCHA verified - token received');
    setCaptchaToken(token);
    setCaptchaError(null);
  };

  const handleCaptchaError = (error: Error) => {
    console.error('CAPTCHA error:', error);
    setCaptchaError(error.message);
    setCaptchaToken(null);
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
                    placeholder="Password"
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
        
        {captchaError && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{captchaError}</AlertDescription>
          </Alert>
        )}
        
        <TurnstileWidget 
          siteKey="0x4AAAAAABVNY-RtAZWQwtdF"
          onVerify={handleCaptchaVerify}
          onError={handleCaptchaError}
        />
        
        <Button 
          type="submit" 
          className="w-full h-12 sm:h-10 text-lg sm:text-base"
          disabled={isLoading || !captchaToken}
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
