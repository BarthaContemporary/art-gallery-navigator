
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
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";
import { OTPVerification } from "@/components/auth/OTPVerification";

export default function Auth() {
  const [showOTP, setShowOTP] = useState(false);
  const [email, setEmail] = useState("");
  
  const { signIn, signInWithPassword, signInWithOTP, verifyOTP } = useAuth();
  const { toast } = useToast();
  const { execute, isLoading } = useSafeAsync();

  const handleLogin = async (values: { email: string; password: string }, captchaToken: string) => {
    setEmail(values.email);
    
    execute(async () => {
      // Try password login first if provided
      if (values.password) {
        try {
          await signInWithPassword(values.email, values.password, captchaToken);
          return { needsOTP: false };
        } catch (error) {
          // If password login fails with invalid credentials, try OTP
          if (error instanceof Error && error.message.includes("Invalid login credentials")) {
            return signInWithOTP(values.email, captchaToken);
          }
          throw error;
        }
      } else {
        // No password provided, use OTP directly
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
        toast({
          title: "Login failed",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleOTPVerify = (values: { otp: string }) => {
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
      </Card>
    </div>
  );
}
