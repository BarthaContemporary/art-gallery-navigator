
import { SidebarNavItem } from "./components/SidebarNavItem";
import { Home, Palette, Users, FileText, Calendar, MapPin, FolderOpen, Share2, Settings, Archive } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const { isAdmin } = useAuth();

  const mainNavItems = [
    { href: "/", icon: Home, name: "Dashboard" },
    { href: "/artworks", icon: Palette, name: "Artworks" },
    { href: "/artists", icon: Users, name: "Artists" },
    { href: "/collections", icon: FolderOpen, name: "Collections" },
    { href: "/file-sharing", icon: Share2, name: "File Sharing" },
    { href: "/locations", icon: MapPin, name: "Locations" },
    { href: "/appointments", icon: Calendar, name: "Appointments" },
  ];

  const adminNavItems = [
    { href: "/crm", icon: Users, name: "CRM" },
    { href: "/projects", icon: Archive, name: "Projects" },
    { href: "/admin", icon: Settings, name: "Admin" },
  ];

  return (
    <nav className="flex-1 px-2 py-6 space-y-2">
      {mainNavItems.map((item) => (
        <SidebarNavItem key={item.href} {...item} />
      ))}

      {isAdmin && (
        <>
          <div className="pt-4 pb-2">
            <div className="w-full h-px bg-gray-200 mx-auto"></div>
          </div>
          {adminNavItems.map((item) => (
            <SidebarNavItem key={item.href} {...item} />
          ))}
        </>
      )}
    </nav>
  );
}
