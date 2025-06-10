
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      setIsNavigating(true);
      navigate("/auth", { state: { from: location }, replace: true });
    } else if (!isLoading && user) {
      setIsNavigating(false);
    }
  }, [user, isLoading, navigate, location]);

  if (isLoading || isNavigating) {
    return <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>;
  }

  return user ? <>{children}</> : null;
}
