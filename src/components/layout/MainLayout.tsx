
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { MobileSidebar } from "./MobileSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function MainLayout() {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background">
      {isMobile ? <MobileSidebar /> : <Sidebar />}
      <main className="flex-1 overflow-auto px-2 pt-4 pb-8 sm:px-6 sm:pt-10">
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
