
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
import { OTPVerification } from "@/components/auth/OTPVerification";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { ErrorDisplay } from "@/components/ui/error-display";
import { DebugInfo } from "@/components/ui/debug-info";
import { AuthStatusMonitor } from "@/components/auth/AuthStatusMonitor";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react"; // Added this import

type AuthTab = "login" | "otp";

function Auth() {
  const { user, isLoading, signIn, verifyOTP, signUp } = useAuth();
  const [selectedTab, setSelectedTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState<string>("");
  const [authError, setAuthError] = useState<Error | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";
  
  const debugInfo = {
    redirectPath: from,
    authState: !!user,
    isLoading,
    currentLocation: location.pathname
  };
  
  useEffect(() => {
    if (user && !isLoading) {
      logger.log("User is authenticated, redirecting to:", from);
      navigate(from, { replace: true });
    }
  }, [user, isLoading, navigate, from]);
  
  const handleOtpRequested = (userEmail: string) => {
    setEmail(userEmail);
    setSelectedTab("otp");
  };
  
  const handleAuthError = (error: Error) => {
    logger.error("Authentication error on Auth page:", error);
    setAuthError(error);
  };
  
  const resetError = () => {
    setAuthError(null);
  };

  const handleLoginSubmit = async (values: { email: string; password?: string }, captchaToken: string) => {
    try {
      resetError();
      logger.log("Auth page: handleLoginSubmit with captcha token:", captchaToken ? "Present" : "Absent");
      const { needsOTP } = await signIn(
        values.email, 
        values.password || "", // Provide empty string if password is not present (for OTP only flows)
        captchaToken // Pass captcha token
      );
      if (needsOTP) {
        handleOtpRequested(values.email);
      }
    } catch (error) {
      if (error instanceof Error) {
        handleAuthError(error);
      } else {
        handleAuthError(new Error("An unknown login error occurred"));
      }
    }
  };

  const handleOtpSubmit = async (values: { otp: string }) => {
    try {
      resetError();
      // Note: OTP verification itself might not directly involve a captcha token in its current flow
      // as the captcha was likely verified at the `signInWithOtp` (request OTP) stage.
      // If verifyOTP itself needs a captcha for some reason, useAuth and its types would need update.
      await verifyOTP(email, values.otp);
    } catch (error) {
      if (error instanceof Error) {
        handleAuthError(error);
      } else {
        handleAuthError(new Error("An unknown OTP error occurred"));
      }
    }
  };
  
  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user) {
    // If user is authenticated, useEffect above should handle redirection.
    // This return null prevents rendering the auth form if user is already logged in
    // and waiting for redirection.
    return null;
  }
  
  return (
    <ErrorBoundary>
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md px-4">
          <Card className="p-6 shadow-lg">
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold">Welcome</h1>
              <p className="text-muted-foreground mt-2">Sign in to your account</p>
            </div>
            
            {authError && (
              <ErrorDisplay 
                error={authError} 
                resetError={resetError} 
                showHomeButton={false} // No home button needed on auth page usually
                title="Authentication Error" 
              />
            )}
            
            <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as AuthTab)}>
              <TabsList className="grid grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="otp" disabled={!email}>
                  Verification
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <LoginForm 
                  onSubmit={handleLoginSubmit}
                  isLoading={isLoading} // isLoading from useAuth
                  onOtpRequested={handleOtpRequested}
                  onError={handleAuthError} // Pass the error handler
                />
              </TabsContent>
              
              <TabsContent value="otp">
                <OTPVerification 
                  onSubmit={handleOtpSubmit}
                  onBack={() => setSelectedTab("login")}
                  isLoading={isLoading} // isLoading from useAuth
                  email={email} // Pass the email for context if needed
                  onError={handleAuthError} // Pass the error handler
                />
              </TabsContent>
            </Tabs>
          </Card>
          
          <DebugInfo data={debugInfo} title="Auth Debug Info" />
        </div>
        
        <AuthStatusMonitor />
      </div>
    </ErrorBoundary>
  );
}

export default Auth;
