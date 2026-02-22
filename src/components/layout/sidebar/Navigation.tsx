
import { SidebarNavItem } from "./components/SidebarNavItem";
import { Palette, Users, Calendar, MapPin, FolderOpen, Share2, Settings, Archive, Image, Contact, BookOpen, Music, Camera } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const { isAdmin } = useAuth();

  const navItems = [
    { href: "/artworks", icon: Palette, name: "Artworks" },
    { href: "/collections", icon: FolderOpen, name: "Collections" },
    ...(isAdmin ? [
      { href: "/crm", icon: Contact, name: "CRM" },
      { href: "/projects", icon: Archive, name: "Projects" },
      { href: "/viewer", icon: Image, name: "Image Viewer" },
      { href: "/admin/publications", icon: BookOpen, name: "Publications" },
      { href: "/admin/audio", icon: Music, name: "Audio" },
    ] : []),
    { href: "/file-sharing", icon: Share2, name: "File Sharing" },
    { href: "/appointments", icon: Calendar, name: "Appointments" },
    ...(isAdmin ? [
      { href: "/artists", icon: Users, name: "Artists" },
    ] : []),
    { href: "/locations", icon: MapPin, name: "Locations" },
    ...(isAdmin ? [
      { href: "/tours", icon: Camera, name: "Tours" },
      { href: "/admin", icon: Settings, name: "Admin", end: true },
    ] : []),
  ];

  return (
    <nav className="flex-1 px-2 py-6 space-y-2">
      {navItems.map((item) => (
        <SidebarNavItem key={item.href} {...item} />
      ))}
    </nav>
  );
}
