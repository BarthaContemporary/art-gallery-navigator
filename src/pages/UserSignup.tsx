import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { UsersList } from "@/components/auth/UsersList";
import { UploadedFilesList } from "@/components/auth/UploadedFilesList";

export default function UserSignup() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"gallery_admin" | "artist" | "external">("artist");
  const [isLoading, setIsLoading] = useState(false);

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto text-left">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Create and manage user accounts</p>
        </div>
      </div>

      <div className="max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-md mx-auto mb-8 text-left">
        <Card className="shadow-lg border border-border/60 text-left w-full">
          <CardHeader className="px-6 pt-8 pb-2 sm:pt-10 text-left">
            <CardTitle className="text-2xl sm:text-3xl text-left md:text-2xl">
              User Signup
            </CardTitle>
            <CardDescription className="text-base text-left sm:text-base">Add users</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-8 pt-4 sm:pt-2 text-left">
            <form onSubmit={handleSignup} className="space-y-6">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  autoFocus
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="text-base sm:text-sm py-3"
                  inputMode="email"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="text-base sm:text-sm py-3"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="user-role" className="block text-sm font-medium">
                  Role
                </label>
                <select
                  id="user-role"
                  value={role}
                  onChange={e => setRole(e.target.value as "gallery_admin" | "artist" | "external")}
                  className="w-full border rounded-md px-3 py-2 text-base bg-white"
                >
                  <option value="artist">Artist</option>
                  <option value="gallery_admin">Admin</option>
                  <option value="external">External</option>
                </select>
              </div>
              <Button type="submit" className="w-full h-12 sm:h-10 text-lg sm:text-base" disabled={isLoading}>
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-6xl mx-auto text-left mt-8">
        <h2 className="text-2xl font-semibold mb-4">Uploaded Files</h2>
        <UploadedFilesList />
      </div>
    </div>
  );
}
