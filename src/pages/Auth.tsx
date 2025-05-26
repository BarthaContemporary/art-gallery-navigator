
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

type AuthTab = "login" | "otp";

function Auth() {
  const { user, isLoading, signIn, verifyOTP } = useAuth();
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
      console.log("User is authenticated, redirecting to:", from);
      navigate(from, { replace: true });
    }
  }, [user, isLoading, navigate, from]);
  
  const handleOtpRequested = (userEmail: string) => {
    setEmail(userEmail);
    setSelectedTab("otp");
  };
  
  const handleAuthError = (error: Error) => {
    console.error("Authentication error:", error);
    setAuthError(error);
  };
  
  const resetError = () => {
    setAuthError(null);
  };

  const handleLoginSubmit = async (values: { email: string; password?: string }) => { // Removed captchaToken from signature, made password optional
    try {
      resetError();
      const { needsOTP } = await signIn(
        values.email, 
        values.password || ""
        // Removed captchaToken
      );
      if (needsOTP) {
        handleOtpRequested(values.email);
      }
    } catch (error) {
      if (error instanceof Error) {
        handleAuthError(error);
      }
    }
  };

  const handleOtpSubmit = async (values: { otp: string }) => {
    try {
      resetError();
      await verifyOTP(email, values.otp);
    } catch (error) {
      if (error instanceof Error) {
        handleAuthError(error);
      }
    }
  };
  
  if (isLoading) {
    return null;
  }
  
  if (user) {
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
                showHomeButton={false}
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
                  isLoading={isLoading}
                  onOtpRequested={handleOtpRequested}
                  onError={handleAuthError} // onError prop in LoginForm is generic, kept
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
