import { Outlet, NavLink, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard,
  Users,
  Shield,
  Plug,
  Settings,
  ScrollText,
  ChevronRight,
  Menu,
  X,
  BookOpen,
  Music
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const adminNavItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview", end: true },
  { href: "/admin/users", icon: Users, label: "Users & Roles" },
  { href: "/admin/publications", icon: BookOpen, label: "Publications" },
  { href: "/admin/audio", icon: Music, label: "Audio Library" },
  { href: "/admin/integrations", icon: Plug, label: "Integrations" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
  { href: "/admin/logs", icon: ScrollText, label: "Logs & Audit" },
];

export default function AdminLayout() {
  const { isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-full">
      {/* Mobile sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Admin Sub-navigation */}
      <aside className={cn(
        "w-44 border-r border-border bg-muted/30 flex-shrink-0 flex flex-col",
        "fixed md:relative inset-y-0 left-0 z-50 transition-transform duration-200",
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Admin</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">System management</p>
        </div>
        <nav className="p-1.5 space-y-0.5 flex-1">
          {adminNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
