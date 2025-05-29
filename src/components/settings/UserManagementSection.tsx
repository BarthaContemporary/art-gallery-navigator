
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UsersList } from "@/components/auth/UsersList";
import { UploadedFilesList } from "@/components/auth/UploadedFilesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeletionRequestsTable } from "@/components/auth/DeletionRequestsTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export function UserManagementSection() {
  const { isAdmin } = useAuth();
  const { toast: hookToast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"gallery_admin" | "artist" | "external">("artist");
  const [isLoading, setIsLoading] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-xl font-semibold text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSignupError(null);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/email-confirmation'
        }
      });
      
      if (error) {
        throw error;
      }
      
      const userId = data.user?.id;
      if (userId) {
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: userId,
          role
        });
        if (roleError) {
          throw roleError;
        }
      }
      
      hookToast({
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
      hookToast({
        title: "Error",
        description: error.message || "An unknown error occurred.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">User Management</h2>
      
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
          
          <Button type="submit" className="whitespace-nowrap" disabled={isLoading}>
            {isLoading ? "Creating..." : "Add User"}
          </Button>
        </form>
        
        {signupError && (
          <Alert variant="destructive" className="mt-2 max-w-3xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{signupError}</AlertDescription>
          </Alert>
        )}
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
