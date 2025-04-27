
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useSafeAsync } from "@/hooks/use-safe-async";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { OTPVerification } from "@/components/auth/OTPVerification";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Auth() {
  const [showOTP, setShowOTP] = useState(false);
  const [email, setEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  
  const { signInWithPassword, signInWithOTP, verifyOTP } = useAuth();
  const { toast } = useToast();
  const { execute, isLoading } = useSafeAsync();

  const handleLogin = async (values: { email: string; password: string }, captchaToken: string) => {
    setEmail(values.email);
    setAuthError(null);
    
    console.log("Login attempt initiated with CAPTCHA token:", captchaToken ? "provided" : "missing");
    
    execute(async () => {
      // Try password login first if provided
      if (values.password) {
        try {
          console.log("Attempting password login...");
          await signInWithPassword(values.email, values.password, captchaToken);
          return { needsOTP: false };
        } catch (error) {
          // If password login fails with invalid credentials, try OTP
          if (error instanceof Error) {
            console.log("Password login error:", error.message);
            
            if (error.message.includes("Invalid login credentials")) {
              console.log("Invalid credentials, falling back to OTP...");
              return signInWithOTP(values.email, captchaToken);
            }
            
            if (error.message.includes("captcha")) {
              setAuthError(`CAPTCHA verification failed: ${error.message}`);
              throw error;
            }
          }
          throw error;
        }
      } else {
        // No password provided, use OTP directly
        console.log("No password provided, using OTP directly...");
        return signInWithOTP(values.email, captchaToken);
      }
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
        
        // Special handling for CAPTCHA-related errors
        if (error.message.includes("captcha")) {
          setAuthError(`CAPTCHA verification failed: ${error.message.replace(/^.*captcha[^:]*:\s*/i, "")}`);
        } else {
          toast({
            title: "Login failed",
            description: error.message,
            variant: "destructive",
          });
        }
      }
    });
  };

  const handleOTPVerify = (values: { otp: string }) => {
    setAuthError(null);
    
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
      }
    });
  };

  const handleBack = () => {
    setShowOTP(false);
    setAuthError(null);
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
        
        {authError && (
          <div className="px-6">
            <Alert variant="warning" className="py-2">
              <AlertCircle className="h-4 w-4 mr-2 text-amber-600" />
              <AlertDescription className="text-amber-600">{authError}</AlertDescription>
            </Alert>
          </div>
        )}
        
        <CardContent className="px-6 pb-8 pt-4 sm:pt-2">
          {!showOTP ? (
            <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
          ) : (
            <OTPVerification 
              onSubmit={handleOTPVerify}
              onBack={handleBack}
              isLoading={isLoading}
            />
          )}
        </CardContent>
        
        <CardFooter className="px-6 pb-6 pt-0 flex flex-col items-center text-center">
          <p className="text-sm text-muted-foreground">
            {captchaErrorHint()}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

// Helper function to provide hints for common CAPTCHA issues
function captchaErrorHint(): JSX.Element | null {
  const host = window.location.hostname;
  
  // Only show hints in development or test environments
  if (host.includes('localhost') || host.includes('.lovableproject.com')) {
    return (
      <span>
        If you're experiencing CAPTCHA issues, check that your browser allows third-party cookies 
        and has JavaScript enabled.
      </span>
    );
  }
  
  return null;
}
