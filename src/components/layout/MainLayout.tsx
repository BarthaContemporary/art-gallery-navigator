
import { Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function MainLayout() {
  const { signOut } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className="flex h-screen">
      {/* Include Sidebar for desktop */}
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b px-4 flex items-center justify-between">
          {/* Include MobileSidebar for mobile */}
          {isMobile && <MobileSidebar />}
          
          <div className="ml-auto">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={signOut}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
