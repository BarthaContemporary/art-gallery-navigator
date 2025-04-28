
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Loader } from "lucide-react";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      setIsNavigating(true);
      navigate("/auth", { state: { from: location }, replace: true });
    }
  }, [user, isLoading, navigate, location]);

  if (isLoading || isNavigating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <>{children}</> : null;
}
