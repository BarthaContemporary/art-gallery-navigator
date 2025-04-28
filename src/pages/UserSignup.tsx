import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { UsersList } from "@/components/auth/UsersList";
import { UploadedFilesList } from "@/components/auth/UploadedFilesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeletionRequestsTable } from "@/components/auth/DeletionRequestsTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";

export default function UserSignup() {
  const {
    isAdmin
  } = useAuth();
  const {
    toast
  } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"gallery_admin" | "artist" | "external">("artist");
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  if (!isAdmin) {
    return <div className="flex h-full items-center justify-center">
        <p className="text-xl font-semibold text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>;
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupError(null);
    
    try {
      const {
        data,
        error
      } = await supabase.auth.signUp({
        email,
        password
      });
      if (error) {
        throw error;
      }
      const userId = data.user?.id;
      if (userId) {
        const {
          error: roleError
        } = await supabase.from("user_roles").insert({
          user_id: userId,
          role
        });
        if (roleError) {
          throw roleError;
        }
      }
      toast({
        title: "User created",
        description: `The user ${email} was created successfully.`,
        variant: "default"
      });
      setEmail("");
      setPassword("");
      setRole("artist");
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="USER MANAGEMENT" />

      <div className="w-full max-w-full sm:max-w-md mx-auto px-2 sm:px-0">
        <Card className="shadow-lg border border-border/60">
          <CardHeader className="px-4 pt-6 pb-2">
            <CardTitle className="text-lg sm:text-2xl">User Signup</CardTitle>
            <CardDescription>Add users</CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {signupError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{signupError}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSignup} className="space-y-4">
              <Input 
                type="email" 
                placeholder="Email" 
                value={email} 
                autoFocus 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="w-full text-base sm:text-sm" 
                inputMode="email" 
                autoComplete="email" 
              />
              <Input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="w-full text-base sm:text-sm" 
                autoComplete="new-password" 
              />
              <div>
                <label htmlFor="user-role" className="block text-sm font-medium mb-1">
                  Role
                </label>
                <select 
                  id="user-role" 
                  value={role} 
                  onChange={e => setRole(e.target.value as "gallery_admin" | "artist" | "external")}
                  className="w-full border rounded-md px-3 py-2 bg-background text-base sm:text-sm"
                >
                  <option value="artist">Artist</option>
                  <option value="gallery_admin">Admin</option>
                  <option value="external">External</option>
                </select>
              </div>
              <Button type="submit" className="w-full text-base sm:text-sm" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 -mx-4 sm:mx-0">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
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
