
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
  CardTitle 
} from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useSafeAsync } from "@/hooks/use-safe-async";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const { signIn, verifyOTP } = useAuth();
  const { toast } = useToast();
  const { execute, isLoading } = useSafeAsync();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    execute(async () => {
      const { needsOTP } = await signIn(email, password);
      return { needsOTP };
    }, {
      onSuccess: (result) => {
        if (result?.needsOTP) {
          setShowOTP(true);
          toast({
            title: "Check your email",
            description: "We've sent you a one-time password.",
          });
        }
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    execute(async () => {
      await verifyOTP(email, otpToken);
    }, {
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2 sm:px-4">
      <Card className="w-full max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-md shadow-lg border border-border/60">
        <CardHeader className="px-6 pt-8 pb-2 sm:pt-10">
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl">Login</CardTitle>
          <CardDescription className="text-base sm:text-lg">
            {showOTP ? "Enter the code sent to your email" : "Welcome back! Please login to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-4 sm:pt-2">
          {!showOTP ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  autoFocus
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-base sm:text-sm py-3"
                  inputMode="email"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="text-base sm:text-sm py-3"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 sm:h-10 text-lg sm:text-base"
                disabled={isLoading}
              >
                {isLoading ? "Processing..." : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOTPSubmit} className="space-y-6">
              <div className="space-y-4">
                <InputOTP maxLength={6} value={otpToken} onChange={setOtpToken} disabled={isLoading}>
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
              <Button 
                type="submit" 
                className="w-full h-12 sm:h-10 text-lg sm:text-base"
                disabled={isLoading || otpToken.length !== 6}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
