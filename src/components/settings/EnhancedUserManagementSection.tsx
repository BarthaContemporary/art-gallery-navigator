
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UsersList } from "@/components/auth/UsersList";
import { UploadedFilesList } from "@/components/auth/UploadedFilesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeletionRequestsTable } from "@/components/auth/DeletionRequestsTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { UserCreationErrorHandler } from "./UserCreationErrorHandler";
import { useEnhancedUserCreation } from "@/hooks/use-enhanced-user-creation";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAABVNY-RtAZWQwtdF";

export function EnhancedUserManagementSection() {
  const { isAdmin } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"gallery_admin" | "artist" | "external">("artist");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [lastCreatedUser, setLastCreatedUser] = useState<string | null>(null);
  const [creationError, setCreationError] = useState<any>(null);

  const { 
    createUser, 
    retryCreateUser, 
    sendManualActivation, 
    isLoading, 
    retryCount 
  } = useEnhancedUserCreation();

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl font-semibold text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const handleCaptchaVerify = useCallback((token: string) => {
    console.log("CAPTCHA verified in EnhancedUserManagementSection, token received.");
    setCaptchaToken(token);
    setCaptchaError(null);
  }, []);

  const handleCaptchaError = useCallback(() => {
    console.error("CAPTCHA error in EnhancedUserManagementSection callback.");
    setCaptchaError("CAPTCHA challenge failed. You can still try to create the user without CAPTCHA verification.");
    setCaptchaToken(null);
  }, []);

  const handleCaptchaExpire = useCallback(() => {
    console.warn("CAPTCHA expired in EnhancedUserManagementSection callback.");
    setCaptchaError("CAPTCHA challenge expired. Please complete it again or try without CAPTCHA.");
    setCaptchaToken(null);
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreationError(null);
    setLastCreatedUser(null);

    const result = await createUser({
      email,
      password,
      role,
      captchaToken
    });

    if (result.success) {
      setEmail("");
      setPassword("");
      setRole("artist");
      setCaptchaToken(null);
      setCaptchaError(null);
      setLastCreatedUser(email);
    } else if (result.error) {
      setCreationError(result.error);
      setLastCreatedUser(email);
    }
  };

  const handleRetry = async () => {
    if (!lastCreatedUser) return;
    
    setCreationError(null);
    
    const result = await retryCreateUser({
      email: lastCreatedUser,
      password,
      role,
      captchaToken
    });

    if (result.success) {
      setCreationError(null);
      setLastCreatedUser(null);
    } else if (result.error) {
      setCreationError(result.error);
    }
  };

  const handleManualActivation = async (userEmail: string) => {
    const success = await sendManualActivation(userEmail);
    if (success) {
      setCreationError(null);
      setLastCreatedUser(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <form onSubmit={handleSignup} className="flex flex-wrap gap-2 max-w-3xl">
          <Input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
            className="flex-1 min-w-[200px]" 
            inputMode="email" 
            autoComplete="email" 
          />
          
          <Input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
            className="flex-1 min-w-[200px]" 
            autoComplete="new-password"
            spellCheck="false"
            autoCapitalize="off"
          />
          
          <select 
            value={role} 
            onChange={e => setRole(e.target.value as "gallery_admin" | "artist" | "external")}
            className="h-10 px-3 rounded-md border border-input bg-background text-base sm:text-sm min-w-[120px]"
          >
            <option value="artist">Artist</option>
            <option value="gallery_admin">Admin</option>
            <option value="external">External</option>
          </select>
          
          <Button 
            type="submit" 
            className="whitespace-nowrap" 
            disabled={isLoading}
          >
            {isLoading ? "Creating..." : "Add User"}
          </Button>
        </form>

        <div className="mt-4 flex justify-center">
          <TurnstileWidget
            onVerify={handleCaptchaVerify}
          />
        </div>

        {captchaError && (
          <Alert variant="default" className="mt-2 max-w-3xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{captchaError}</AlertDescription>
          </Alert>
        )}

        {retryCount > 0 && (
          <Alert variant="default" className="mt-2 max-w-3xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Retry attempt {retryCount} - Using fallback creation method without CAPTCHA
            </AlertDescription>
          </Alert>
        )}

        <UserCreationErrorHandler
          error={creationError}
          onRetry={handleRetry}
          onManualActivation={handleManualActivation}
          userEmail={lastCreatedUser || undefined}
          isRetrying={isLoading}
        />
      </div>

      <div className="-mx-4 sm:mx-0">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="deletion-requests">Deletion</TabsTrigger>
            <TabsTrigger value="uploads">Uploads</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="border rounded-md overflow-x-auto">
            <UsersList />
          </TabsContent>
          
          <TabsContent value="deletion-requests" className="border rounded-md overflow-x-auto">
            <DeletionRequestsTable />
          </TabsContent>

          <TabsContent value="uploads" className="border rounded-md overflow-x-auto">
            <UploadedFilesList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
