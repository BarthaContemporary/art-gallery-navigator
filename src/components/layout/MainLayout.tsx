
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export function MainLayout() {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b px-4 flex items-center">
            {isMobile && <MobileSidebar />}
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
