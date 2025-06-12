
import { useState, useEffect, useCallback } from "react";
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
import { Loader2 } from "lucide-react";

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
      logger.log("Auth page: User is authenticated, redirecting to:", from);
      navigate(from, { replace: true });
    }
  }, [user, isLoading, navigate, from]);
  
  const handleOtpRequested = useCallback((userEmail: string) => {
    setEmail(userEmail);
    setSelectedTab("otp");
  }, [setEmail, setSelectedTab]);
  
  const handleAuthError = useCallback((error: Error) => {
    logger.error("Authentication error on Auth page:", error);
    setAuthError(error);
  }, [setAuthError]);
  
  const resetError = useCallback(() => {
    setAuthError(null);
  }, [setAuthError]);

  const handleLoginSubmit = useCallback(async (values: { email: string; password?: string }, captchaToken: string) => {
    try {
      resetError();
      logger.log("Auth page: handleLoginSubmit for email:", values.email, "Captcha token present:", !!captchaToken);
      const { needsOTP } = await signIn(
        values.email, 
        values.password || "", 
        captchaToken
      );
      if (needsOTP) {
        handleOtpRequested(values.email);
      }
    } catch (error) {
      if (error instanceof Error) {
        handleAuthError(error);
      } else {
        logger.error("Auth page: Unknown login error occurred", error);
        handleAuthError(new Error("An unknown login error occurred"));
      }
    }
  }, [resetError, signIn, handleOtpRequested, handleAuthError]);
  
  const handleOtpSubmit = useCallback(async (values: { otp: string }) => {
    try {
      resetError();
      logger.log("Auth page: handleOtpSubmit for email:", email);
      await verifyOTP(email, values.otp);
    } catch (error) {
      if (error instanceof Error) {
        handleAuthError(error);
      } else {
        logger.error("Auth page: Unknown OTP error occurred", error);
        handleAuthError(new Error("An unknown OTP error occurred"));
      }
    }
  }, [resetError, email, verifyOTP, handleAuthError]);
  
  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <Loader2 className="h-8 w-8 md:h-10 md:w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user) {
    logger.log("Auth page: User is authenticated, awaiting redirection effect.");
    return null;
  }
  
  return (
    <ErrorBoundary>
      <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 px-3 py-6">
        <div className="w-full max-w-[320px] sm:max-w-sm mx-auto">
          <Card className="p-4 sm:p-6 border rounded-lg bg-card">
            {/* Logo Header */}
            <div className="mb-6 text-center">
              <div className="flex justify-center mb-4">
                <img
                  src="/lovable-uploads/71e438d3-4f7d-4489-9aae-752771abaf09.png"
                  alt="B_c Logo"
                  className="h-10 sm:h-12 md:h-16 w-auto object-contain"
                />
              </div>
            </div>
            
            {authError && (
              <ErrorDisplay 
                error={authError} 
                resetError={resetError} 
                showHomeButton={false}
                title="Authentication Error" 
              />
            )}
            
            <Tabs value={selectedTab} onValueChange={(value) => setSelectedTab(value as AuthTab)}>
              <TabsContent value="login" className="mt-0">
                <LoginForm 
                  onSubmit={handleLoginSubmit}
                  isLoading={isLoading} 
                  onOtpRequested={handleOtpRequested}
                  onError={handleAuthError}
                />
              </TabsContent>
              
              <TabsContent value="otp" className="mt-0">
                <OTPVerification 
                  onSubmit={handleOtpSubmit}
                  onBack={() => setSelectedTab("login")}
                  isLoading={isLoading} 
                  email={email}
                  onError={handleAuthError}
                />
              </TabsContent>

              <TabsList className="grid grid-cols-2 mt-6 h-9 sm:h-10 w-full">
                <TabsTrigger value="login" className="text-xs sm:text-sm font-thin">Login</TabsTrigger>
                <TabsTrigger value="otp" disabled={!email} className="text-xs sm:text-sm font-thin">
                  Verification
                </TabsTrigger>
              </TabsList>
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
