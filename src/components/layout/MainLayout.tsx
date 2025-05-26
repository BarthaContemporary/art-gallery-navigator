
import { Outlet } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/layout/sidebar/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useInactivity } from "@/hooks/use-inactivity";

export function MainLayout() {
  const isMobile = useIsMobile();
  useInactivity();

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar />
        {isMobile && <MobileSidebar />}
        <div className="flex-1 flex flex-col">
          {/* 
            Adjust top padding:
            - On mobile (sm:hidden), use pt-16 (64px) to account for the new fixed MobileSidebar header.
            - On larger screens (sm:pt-[50px]), keep the original padding or adjust as needed for desktop header if any.
              Currently, the desktop sidebar is part of the flex layout, so pt-[50px] was likely for a top bar that might exist in some configurations or for content spacing.
              If there's no fixed top bar on desktop, this padding might not be strictly necessary or could be reduced.
              For now, we will conditionally apply padding.
          */}
          <main className={`flex-1 overflow-auto ${isMobile ? 'pt-16' : 'pt-[50px]'}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
