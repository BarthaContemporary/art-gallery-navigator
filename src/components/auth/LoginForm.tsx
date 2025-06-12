
import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
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
  const handleCaptchaVerify = useCallback((token: string) => {
    console.log("CAPTCHA verified successfully, token:", token ? "present" : "missing");
    setCaptchaToken(token);
    setCaptchaError(false);
  }, []);
  const handleCaptchaError = useCallback(() => {
    console.error("CAPTCHA verification failed");
    setCaptchaError(true);
    setCaptchaToken("");
    toast.error("Security verification failed. Please try again.");
  }, []);
  const handleCaptchaExpire = useCallback(() => {
    console.warn("CAPTCHA token expired");
    setCaptchaToken("");
    toast.warning("Security verification expired. Please complete it again.");
  }, []);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaToken) {
      toast.error("Please complete the security verification first.");
      return;
    }
    try {
      await onSubmit({
        email,
        password: password || undefined
      }, captchaToken);
    } catch (error) {
      console.error("Login form submission error:", error);
      if (error instanceof Error) {
        onError(error);
      }
    }
  };

  // Get the site key from the environment variable
  const turnstileSiteKey = "0x4AAAAAABVNY-RtAZWQwtdF";
  
  return (
    <Card className="w-full max-w-md mx-auto border-0">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl text-center font-thin">Sign In</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {captchaError && <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Security verification failed. Please try again.
            </AlertDescription>
          </Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-thin">Email</Label>
            <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required className="text-sm md:text-base" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="font-thin">Password (optional)</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} placeholder="Enter password or leave blank for OTP" value={password} onChange={e => setPassword(e.target.value)} className="text-sm md:text-base pr-10" />
              <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-thin">Security Verification</Label>
            <TurnstileWidget siteKey={turnstileSiteKey} onVerify={handleCaptchaVerify} onError={handleCaptchaError} onExpire={handleCaptchaExpire} />
            {captchaToken && <p className="text-xs text-green-600">✓ Security verification completed</p>}
          </div>

          <Button type="submit" className="w-full text-sm md:text-base" disabled={isLoading || !captchaToken}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <p className="text-xs md:text-sm text-gray-600">
            Leave password blank to receive a verification code via email
          </p>
          {!captchaToken && <p className="text-xs text-orange-600">
              Complete security verification to continue
            </p>}
        </div>
      </CardContent>
    </Card>
  );
}
