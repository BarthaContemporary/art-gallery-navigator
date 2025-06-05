
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { useSecureAuth } from "@/hooks/use-secure-auth";
import { TurnstileWidget } from "./TurnstileWidget";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface LoginFormProps {
  onSubmit: (values: { email: string; password?: string }, captchaToken: string) => Promise<void>;
  isLoading: boolean;
  onOtpRequested: (email: string) => void;
  onError: (error: Error) => void;
}

export function LoginForm({ onSubmit, isLoading, onOtpRequested, onError }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>("");
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  const handleCaptchaVerify = useCallback((token: string) => {
    console.log("CAPTCHA verified successfully");
    setCaptchaToken(token);
    setCaptchaError(false);
  }, []);

  const handleCaptchaError = useCallback(() => {
    console.error("CAPTCHA error in LoginForm callback.");
    setCaptchaError(true);
    setCaptchaToken("");
    // Don't throw error here, just show fallback option
    toast.warning("CAPTCHA verification failed. You can still try to sign in without it.");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttemptCount(prev => prev + 1);
    
    // Show CAPTCHA after 2 attempts, but don't require it if it's failing
    if (attemptCount >= 2 && !showCaptcha && !captchaError) {
      setShowCaptcha(true);
      toast.info("Additional security verification requested");
      return;
    }

    try {
      // Use empty string as fallback if CAPTCHA is failing
      const tokenToUse = captchaError ? "" : captchaToken;
      await onSubmit({ email, password: password || undefined }, tokenToUse);
    } catch (error) {
      console.error("Login form submission error:", error);
      if (error instanceof Error) {
        onError(error);
      }
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl text-center">Sign In</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {captchaError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Security verification is temporarily unavailable. You can still sign in normally.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-sm md:text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password (optional)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password or leave blank for OTP"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-sm md:text-base pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {showCaptcha && !captchaError && (
            <div className="space-y-2">
              <Label>Security Verification</Label>
              <TurnstileWidget
                siteKey="0x4AAAAAABVNY-RtAZWQwtdF"
                onVerify={handleCaptchaVerify}
                onError={handleCaptchaError}
              />
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full text-sm md:text-base" 
            disabled={isLoading || (showCaptcha && !captchaToken && !captchaError)}
          >
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-xs md:text-sm text-gray-600">
            Leave password blank to receive a verification code via email
          </p>
          {attemptCount > 0 && (
            <p className="text-xs text-gray-500">
              Attempt {attemptCount} - {showCaptcha ? 'Security verification active' : 'Standard login'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
