
import { Outlet, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/layout/sidebar/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useInactivity } from "@/hooks/use-inactivity";
import { ChatPopup } from "@/components/chat/ChatPopup";

export function MainLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  useInactivity();

  // Don't show chat popup on auth-related pages
  const isAuthPage = location.pathname.startsWith('/auth') || 
                     location.pathname.startsWith('/login') ||
                     location.pathname.startsWith('/signup');

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        {/* Desktop sidebar - always visible on desktop */}
        {!isMobile && (
          <div className="flex-shrink-0">
            <Sidebar />
          </div>
        )}
        
        {/* Mobile sidebar */}
        {isMobile && <MobileSidebar />}
        
        <div className="flex-1 flex flex-col min-w-0">
          <main className={`flex-1 overflow-auto ${isMobile ? 'pt-12' : ''} touch-pan-y`}>
            <Outlet />
          </main>
        </div>

        {/* Chat Popup - only show on non-auth pages */}
        {!isAuthPage && <ChatPopup />}
      </div>
    </SidebarProvider>
  );
}
