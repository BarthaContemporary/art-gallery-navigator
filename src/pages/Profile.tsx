import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl tracking-wide font-semibold">Profile</h1>
        </div>
      </div>
      
      <Card className="w-full max-w-md mx-auto p-4 shadow-md">
        <CardHeader className="flex flex-col items-center">
          <Avatar className="h-20 w-20 mb-2">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback>
              {user?.email?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="mt-2 text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 border rounded-md p-3 bg-muted">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <div className="text-xs text-muted-foreground font-semibold">Email</div>
              <div className="text-sm font-medium">{user?.email}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
