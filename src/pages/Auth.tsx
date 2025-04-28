
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  
  const { signInWithPassword, signInWithOTP, verifyOTP, session } = useAuth();
  const { toast } = useToast();
  const { execute, isLoading } = useSafeAsync();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      navigate("/");
    }
  }, [session, navigate]);

  const handleLogin = async (values: { email: string; password: string }, captchaToken: string) => {
    setEmail(values.email);
    setAuthError(null);
    
    console.log("Login attempt initiated with CAPTCHA token:", captchaToken ? "provided" : "missing");
    
    execute(async () => {
      if (values.password) {
        try {
          console.log("Attempting password login...");
          await signInWithPassword(values.email, values.password, captchaToken);
          return { needsOTP: false };
        } catch (error) {
          if (error instanceof Error) {
            console.log("Password login error:", error.message);
            
            // In development mode, always fall back to OTP if password login fails
            if (captchaToken === "development-mode" || error.message.includes("Invalid login credentials")) {
              console.log("Invalid credentials or dev mode, falling back to OTP...");
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
          navigate("/");
        }
      },
      onError: (error) => {
        console.error('Login error:', error);
        
        // Special handling for development mode - always show a helpful message
        if (captchaToken === "development-mode" && error.message.includes("captcha")) {
          setAuthError("Development mode: CAPTCHA would normally fail here, but we're allowing login in development mode. If this persists, check your Supabase edge function configuration.");
        } else if (error.message.includes("captcha")) {
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

  const handleOTPVerify = async (values: { otp: string }) => {
    setAuthError(null);
    
    execute(async () => {
      await verifyOTP(email, values.otp);
      navigate("/");
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

function captchaErrorHint(): JSX.Element | null {
  const host = window.location.hostname;
  const isDev = process.env.NODE_ENV === 'development' || 
                host.includes('localhost') || 
                host.includes('.lovableproject.com');
  
  if (isDev) {
    return (
      <span>
        Development mode: CAPTCHA validation is disabled. In production, users would need to complete CAPTCHA verification.
      </span>
    );
  }
  
  return (
    <span>
      If you're experiencing CAPTCHA issues, check that your browser allows third-party cookies 
      and has JavaScript enabled.
    </span>
  );
}
