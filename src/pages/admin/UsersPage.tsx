import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UsersTable } from "@/components/auth/UsersTable";
import { DeletionRequestsTable } from "@/components/auth/DeletionRequestsTable";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAABVNY-RtAZWQwtdF";

export default function UsersPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"gallery_admin" | "artist" | "external">("artist");
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
    setCaptchaError(null);
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupError(null);

    if (!captchaToken) {
      setCaptchaError("Please complete the CAPTCHA challenge.");
      setIsLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/email-confirmation',
          captchaToken
        }
      });
      
      if (error) throw error;
      
      const userId = data.user?.id;
      if (userId) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: userId,
          role
        });
        if (roleError) throw roleError;
      }
      
      toast({
        title: "User created",
        description: `The user ${email} was created successfully.`,
      });
      
      setEmail("");
      setPassword("");
      setRole("artist");
      setCaptchaToken(null);
    } catch (error: any) {
      console.error("User signup error:", error);
      setSignupError(error.message || "An unknown error occurred.");
      toast({
        title: "Error",
        description: error.message || "An unknown error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users & Roles</h1>
        <p className="text-muted-foreground text-sm">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="invite">Invite User</TabsTrigger>
          <TabsTrigger value="deletion">Deletion Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>View and manage all registered users</CardDescription>
            </CardHeader>
            <CardContent>
              <UsersTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create New User
              </CardTitle>
              <CardDescription>
                Invite a new user to the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignup} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input 
                    type="email" 
                    placeholder="user@example.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required
                    inputMode="email"
                    autoComplete="email"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input 
                    type="password" 
                    placeholder="Minimum 6 characters" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required
                    autoComplete="new-password"
                    spellCheck="false"
                    autoCapitalize="off"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value as "gallery_admin" | "artist" | "external")}
                    className="w-full h-10 px-3 border border-input bg-background text-sm"
                  >
                    <option value="artist">Artist</option>
                    <option value="gallery_admin">Admin</option>
                    <option value="external">External</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Admins have full access. Artists can manage their own content. External users have limited access.
                  </p>
                </div>

                <div className="flex justify-center">
                  <TurnstileWidget onVerify={handleCaptchaVerify} />
                </div>

                {captchaError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{captchaError}</AlertDescription>
                  </Alert>
                )}
                
                {signupError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{signupError}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={isLoading || !captchaToken}
                >
                  {isLoading ? "Creating..." : "Create User"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deletion">
          <Card>
            <CardHeader>
              <CardTitle>Deletion Requests</CardTitle>
              <CardDescription>Review and process user deletion requests</CardDescription>
            </CardHeader>
            <CardContent>
              <DeletionRequestsTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
