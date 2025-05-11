
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
import { OTPVerification } from "@/components/auth/OTPVerification";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader } from "lucide-react";
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
  
  // Get the page to redirect to after login
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";
  
  // Add debug info about the redirect path
  const debugInfo = {
    redirectPath: from,
    authState: !!user,
    isLoading,
    currentLocation: location.pathname
  };
  
  // Redirect if already authenticated
  useEffect(() => {
    if (user && !isLoading) {
      console.log("User is authenticated, redirecting to:", from);
      navigate(from, { replace: true });
    }
  }, [user, isLoading, navigate, from]);
  
  // Handle OTP request completion
  const handleOtpRequested = (userEmail: string) => {
    setEmail(userEmail);
    setSelectedTab("otp");
  };
  
  // Handle authentication errors
  const handleAuthError = (error: Error) => {
    console.error("Authentication error:", error);
    setAuthError(error);
  };
  
  // Reset any auth errors
  const resetError = () => {
    setAuthError(null);
  };

  // Handle login form submission
  const handleLoginSubmit = async (values: { email: string; password: string }, captchaToken: string) => {
    try {
      resetError();
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
      }
    }
  };

  // Handle OTP verification submission
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
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Redirecting...</p>
        </div>
      </div>
    );
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
          
          {/* Debug information - only visible in development */}
          <DebugInfo data={debugInfo} title="Auth Debug Info" />
        </div>
        
        {/* Auth status monitor - only in development */}
        <AuthStatusMonitor />
      </div>
    </ErrorBoundary>
  );
}

export default Auth;
