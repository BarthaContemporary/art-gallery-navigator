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
      <div className="flex items-center justify-center min-h-screen">
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
      <div className="flex items-center justify-center min-h-screen bg-background dark:bg-gray-900 p-3 md:p-4">
        <div className="w-full max-w-md">
          <Card className="p-3 md:p-6 shadow-lg">
            {/* Logo Header */}
            <div className="mb-6 md:mb-8 text-center">
              <div className="flex justify-center mb-4">
                <img
                  src="/lovable-uploads/d7bfd4a5-c1d1-4827-971b-ca3bbe193513.png"
                  alt="B_c Logo"
                  className="h-12 md:h-16 w-auto object-contain"
                />
              </div>
              <p className="text-muted-foreground text-sm">Sign in to your account</p>
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
              <TabsList className="grid grid-cols-2 mb-3 md:mb-6 h-7 md:h-10">
                <TabsTrigger value="login" className="text-xs md:text-sm">Login</TabsTrigger>
                <TabsTrigger value="otp" disabled={!email} className="text-xs md:text-sm">
                  Verification
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login">
                <LoginForm 
                  onSubmit={handleLoginSubmit}
                  isLoading={isLoading} 
                  onOtpRequested={handleOtpRequested}
                  onError={handleAuthError}
                />
              </TabsContent>
              
              <TabsContent value="otp">
                <OTPVerification 
                  onSubmit={handleOtpSubmit}
                  onBack={() => setSelectedTab("login")}
                  isLoading={isLoading} 
                  email={email}
                  onError={handleAuthError}
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
