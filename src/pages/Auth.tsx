
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-2 sm:px-4">
      <Card className="w-full max-w-[95vw] sm:max-w-md md:max-w-lg lg:max-w-md shadow-lg border border-border/60">
        <CardHeader className="px-6 pt-8 pb-2 sm:pt-10">
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl">Login</CardTitle>
          <CardDescription className="text-base sm:text-lg">
            Welcome back! Please login to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-8 pt-4 sm:pt-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                autoFocus
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-base sm:text-sm py-3"
                autoComplete="current-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 sm:h-10 text-lg sm:text-base"
            >
              Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
