
import { SidebarNavItem } from "./components/SidebarNavItem";
import { Home, Palette, Users, FileText, Calendar, MapPin, FolderOpen, Share2, Settings, Archive } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const { isAdmin } = useAuth();

  const mainNavItems = [
    { href: "/", icon: Home, name: "Dashboard" },
    { href: "/artworks", icon: Palette, name: "Artworks" },
    { href: "/artists", icon: Users, name: "Artists" },
    { href: "/file-sharing", icon: Share2, name: "File Sharing" },
    { href: "/collections", icon: FolderOpen, name: "Collections" },
    { href: "/appointments", icon: Calendar, name: "Appointments" },
    { href: "/locations", icon: MapPin, name: "Locations" },
  ];

  const adminNavItems = [
    { href: "/crm", icon: Users, name: "CRM" },
    { href: "/projects", icon: Archive, name: "Projects" },
    { href: "/admin", icon: Settings, name: "Admin" },
  ];

  return (
    <nav className="flex-1 px-4 py-6 space-y-1">
      {mainNavItems.map((item) => (
        <SidebarNavItem key={item.href} {...item} />
      ))}

      {isAdmin && (
        <>
          <div className="pt-4 pb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
              Admin
            </p>
          </div>
          {adminNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}
        </>
      )}
    </nav>
  );
}
