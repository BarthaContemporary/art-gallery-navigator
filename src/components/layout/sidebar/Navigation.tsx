
import { SidebarNavItem } from "./components/SidebarNavItem";
import { Home, Palette, Users, FileText, Calendar, MapPin, FolderOpen, Share2, MessageCircle, Settings, BarChart3, Upload, Archive } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const { isAdmin } = useAuth();

  const mainNavItems = [
    { to: "/", icon: Home, label: "Dashboard" },
    { to: "/artworks", icon: Palette, label: "Artworks" },
    { to: "/artists", icon: Users, label: "Artists" },
    { to: "/documents", icon: FileText, label: "Documents" },
    { to: "/file-sharing", icon: Share2, label: "File Sharing" },
    { to: "/collections", icon: FolderOpen, label: "Collections" },
    { to: "/appointments", icon: Calendar, label: "Appointments" },
    { to: "/locations", icon: MapPin, label: "Locations" },
    { to: "/chat", icon: MessageCircle, label: "Chat" },
  ];

  const adminNavItems = [
    { to: "/crm", icon: Users, label: "CRM" },
    { to: "/projects", icon: Archive, label: "Projects" },
    { to: "/file-transfer", icon: Upload, label: "File Transfer" },
    { to: "/admin", icon: Settings, label: "Admin" },
  ];

  return (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {mainNavItems.map((item) => (
        <SidebarNavItem key={item.to} {...item} />
      ))}

      {isAdmin && (
        <>
          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
              Admin
            </p>
          </div>
          {adminNavItems.map((item) => (
            <SidebarNavItem key={item.to} {...item} />
          ))}
        </>
      )}
    </nav>
  );
}
