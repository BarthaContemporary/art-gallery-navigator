import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, isLoading, isLoadingRoles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    if (!isLoading && !isLoadingRoles) {
      if (!user) {
        setIsNavigating(true);
        navigate("/auth", { state: { from: location }, replace: true });
      } else if (!isAdmin) {
        setIsNavigating(true);
        navigate("/", { replace: true });
      } else {
        setIsNavigating(false);
      }
    }
  }, [user, isAdmin, isLoading, isLoadingRoles, navigate, location]);

  if (isLoading || isLoadingRoles || isNavigating) {
    return <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
    </div>;
  }

  return user && isAdmin ? <>{children}</> : null;
}