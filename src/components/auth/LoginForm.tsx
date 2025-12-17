
import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle, WifiOff, RefreshCw } from "lucide-react";
import { TurnstileWidget } from "./TurnstileWidget";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface LoginFormProps {
  onSubmit: (values: {
    email: string;
    password?: string;
  }, captchaToken: string) => Promise<void>;
  isLoading: boolean;
  onOtpRequested: (email: string) => void;
  onError: (error: Error) => void;
}

// Helper to detect network errors
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("offline") ||
      (error.name === "AuthRetryableFetchError")
    );
  }
  return false;
}

export function LoginForm({
  onSubmit,
  isLoading,
  onOtpRequested,
  onError
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>("");
  const [captchaError, setCaptchaError] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [turnstileKey, setTurnstileKey] = useState(0);

  const handleCaptchaVerify = useCallback((token: string) => {
    console.log("CAPTCHA verified successfully, token:", token ? "present" : "missing");
    setCaptchaToken(token);
    setCaptchaError(false);
  }, []);

  const handleRetry = useCallback(() => {
    setNetworkError(false);
    setCaptchaToken("");
    setTurnstileKey(prev => prev + 1); // Force re-render of Turnstile
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNetworkError(false);
    
    console.log("Login form submission:", {
      email,
      hasPassword: !!password,
      captchaToken: captchaToken ? "present" : "missing"
    });
    
    if (!captchaToken) {
      toast.error("Please complete the security verification first.");
      setCaptchaError(true);
      return;
    }
    
    try {
      await onSubmit({
        email,
        password: password || undefined
      }, captchaToken);
    } catch (error) {
      console.error("Login form submission error:", error);
      if (isNetworkError(error)) {
        setNetworkError(true);
        setCaptchaToken("");
        setTurnstileKey(prev => prev + 1);
      } else if (error instanceof Error) {
        onError(error);
      }
    }
  };

  // Network error state UI
  if (networkError) {
    return (
      <Card className="w-full border-0 shadow-none">
        <CardContent className="px-0 space-y-4">
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <WifiOff className="h-4 w-4" />
            <AlertDescription className="text-sm ml-2">
              <strong>Connection failed</strong>
              <p className="mt-1 text-muted-foreground">
                Unable to reach the authentication server. Please check your internet connection and try again.
              </p>
            </AlertDescription>
          </Alert>
          
          <Button 
            onClick={handleRetry}
            className="w-full h-11 text-sm font-normal"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            If the problem persists, check your firewall settings or try a different network.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full border-0 shadow-none">
      <CardContent className="px-0 space-y-4">
        {captchaError && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Please complete the security verification to continue.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-thin text-sm">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="Enter your email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              className="text-sm h-11 px-3"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="font-thin text-sm">Password (optional)</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="Enter password or leave blank for OTP" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="text-sm h-11 px-3 pr-10"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="absolute right-0 top-0 h-11 px-3" 
                onClick={() => setShowPassword(!showPassword)} 
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-thin text-sm">Security Verification</Label>
            <div className="w-full overflow-hidden">
              <TurnstileWidget 
                key={turnstileKey}
                onVerify={handleCaptchaVerify}
                className="max-w-full"
              />
            </div>
            {captchaToken && (
              <p className="text-xs text-green-600 mt-2">✓ Security verification completed</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full h-11 text-sm font-normal mt-6" 
            disabled={isLoading || !captchaToken}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="text-center space-y-2 mt-6">
          <p className="text-xs text-gray-600 leading-relaxed">
            Leave password blank to receive a verification code via email
          </p>
          {!captchaToken && (
            <p className="text-xs text-orange-600">
              Complete security verification to continue
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
