
import { Outlet, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { useInactivity } from "@/hooks/use-inactivity";
import { ChatPopup } from "@/components/chat/ChatPopup";

export function MainLayout() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { SessionWarning } = useInactivity();

  // Don't show chat popup on auth-related pages
  const isAuthPage = location.pathname.startsWith('/auth') || 
                     location.pathname.startsWith('/login') ||
                     location.pathname.startsWith('/signup');

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full">
        <SessionWarning />
        
        {/* App Sidebar - will collapse to icons on mobile/small screens */}
        <AppSidebar />
        
        <SidebarInset>
          {/* Header with sidebar trigger */}
          <header className="flex h-12 items-center border-b bg-background px-4">
            <SidebarTrigger className="h-8 w-8" />
          </header>
          
          {/* Main content */}
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </SidebarInset>

        {/* Chat Popup - only show on non-auth pages */}
        {!isAuthPage && <ChatPopup />}
      </div>
    </SidebarProvider>
  );
}
