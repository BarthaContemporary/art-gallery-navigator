
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/layout/sidebar/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useInactivity } from "@/hooks/use-inactivity";

export function MainLayout() {
  const isMobile = useIsMobile();
  useInactivity(); // Add inactivity tracking

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full"> {/* Removed border styling */}
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
