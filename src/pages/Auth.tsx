import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter
} from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useSafeAsync } from "@/hooks/use-safe-async";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password")
});

const otpSchema = z.object({
  otp: z.string().length(6, "Please enter the complete verification code")
});

type LoginFormValues = z.infer<typeof loginSchema>;
type OTPFormValues = z.infer<typeof otpSchema>;

export default function Auth() {
  const [showOTP, setShowOTP] = useState(false);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  
  const { signIn, verifyOTP } = useAuth();
  const { toast } = useToast();
  const { execute, isLoading } = useSafeAsync();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: ""
    }
  });

  const handleCaptchaVerify = (token: string) => {
    console.log('CAPTCHA verified successfully');
    setCaptchaToken(token);
    setCaptchaError(null);
  };

  const handleCaptchaError = (error: Error) => {
    console.error('CAPTCHA verification failed:', error);
    setCaptchaError("CAPTCHA verification failed. Please try again.");
    setCaptchaToken(null);
  };

  const resetCaptcha = () => {
    try {
      const container = document.querySelector('[data-turnstile]');
      if (container && window.turnstile) {
        window.turnstile.reset(container);
      }
    } catch (e) {
      console.error('Error resetting CAPTCHA:', e);
    }
  };

  const handleLogin = (values: LoginFormValues) => {
    if (!captchaToken) {
      setCaptchaError("Please complete the CAPTCHA verification");
      return;
    }
    
    setEmail(values.email);
    
    execute(async () => {
      const { needsOTP } = await signIn(values.email, values.password, captchaToken);
      return { needsOTP };
    }, {
      onSuccess: (result) => {
        if (result?.needsOTP) {
          setShowOTP(true);
          toast({
            title: "Check your email",
            description: "We've sent you a one-time password.",
          });
        } else {
          toast({
            title: "Login successful",
            description: "Welcome back!",
          });
        }
      },
      onError: (error) => {
        console.error('Login error:', error);
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
        setCaptchaToken(null);
        resetCaptcha();
      }
    });
  };

  const handleOTPVerify = (values: OTPFormValues) => {
    execute(async () => {
      await verifyOTP(email, values.otp);
    }, {
      onSuccess: () => {
        toast({
          title: "Verification successful",
          description: "You are now logged in.",
        });
      },
      onError: (error) => {
        toast({
          title: "Verification failed",
          description: error.message,
          variant: "destructive",
        });
        otpForm.reset();
      }
    });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2 sm:px-4">
      <Card className="w-full max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-md shadow-lg border border-border/60">
        <CardHeader className="px-6 pt-8 pb-2 sm:pt-10">
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl">
            {showOTP ? "Verify Email" : "Login"}
          </CardTitle>
          <CardDescription className="text-base sm:text-lg">
            {showOTP 
              ? "Enter the code sent to your email" 
              : "Welcome back! Please login to continue."
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-6 pb-4 pt-4 sm:pt-2">
          {!showOTP ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                <FormField
                  control={loginForm.control}
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
                  control={loginForm.control}
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
                            onClick={togglePasswordVisibility}
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
                    <AlertDescription>{captchaError}</AlertDescription>
                  </Alert>
                )}
                
                <TurnstileWidget 
                  siteKey="1x00000000000000000000AA" 
                  onVerify={handleCaptchaVerify}
                  onError={handleCaptchaError}
                />
                
                <Button 
                  type="submit" 
                  className="w-full h-12 sm:h-10 text-lg sm:text-base"
                  disabled={isLoading}
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
          ) : (
            <Form {...otpForm}>
              <form onSubmit={otpForm.handleSubmit(handleOTPVerify)} className="space-y-6">
                <FormField
                  control={otpForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={field.value} onChange={field.onChange} disabled={isLoading}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </FormControl>
                      <FormMessage className="text-center mt-2" />
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full h-12 sm:h-10 text-lg sm:text-base"
                  disabled={isLoading || otpForm.watch("otp").length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : "Verify Code"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
        
        <CardFooter className="px-6 pb-8 pt-0 flex justify-center">
          {showOTP && (
            <Button 
              variant="ghost" 
              onClick={() => {
                setShowOTP(false);
                setCaptchaToken(null);
                loginForm.reset();
                otpForm.reset();
              }}
              disabled={isLoading}
            >
              Back to Login
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
