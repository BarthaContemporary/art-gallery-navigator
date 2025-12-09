import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

export default function ViewerLayout() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="flex-1 overflow-auto h-full">
      <Outlet />
    </main>
  );
}
