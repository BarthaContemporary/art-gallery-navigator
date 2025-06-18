
import { Calendar, Users, Home, PaintBucket, FileText, MapPin, FolderOpen, Building2, UserCheck, Settings } from "lucide-react";
import { useAuth } from "./use-auth";

export const useNavItems = () => {
  const { isAdmin, isArtist } = useAuth();

  const baseItems = [
    // Dashboard - only for admin users
    ...(isAdmin ? [{ title: "Dashboard", href: "/", icon: Home }] : []),
    { title: "Artworks", href: "/artworks", icon: PaintBucket },
    // Artists - only for admin users
    ...(isAdmin ? [{ title: "Artists", href: "/artists", icon: Users }] : []),
    { title: "Collections", href: "/collections", icon: FolderOpen },
    // Projects - only for admin users
    ...(isAdmin ? [{ title: "Projects", href: "/projects", icon: Building2 }] : []),
    { title: "Documents", href: "/documents", icon: FileText },
    // CRM - only for admin users
    ...(isAdmin ? [{ title: "CRM", href: "/crm", icon: UserCheck }] : []),
    { title: "Locations", href: "/locations", icon: MapPin },
    // Appointments - only for admin users
    ...(isAdmin ? [{ title: "Appointments", href: "/appointments", icon: Calendar }] : []),
    ...(isAdmin ? [{ title: "Settings", href: "/settings", icon: Settings }] : [])
  ];

  return baseItems;
};
