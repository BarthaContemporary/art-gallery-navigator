
import { Calendar, Users, Home, PaintBucket, Share2, MapPin, FolderOpen, Building2, UserCheck, Settings } from "lucide-react";
import { useAuth } from "./use-auth";

export const useNavItems = () => {
  const { isAdmin, isArtist } = useAuth();

  const baseItems = [
    // Dashboard - only for admin users
    ...(isAdmin ? [{ title: "Dashboard", href: "/", icon: Home }] : []),
    { title: "Artworks", href: "/artworks", icon: PaintBucket },
    // Artists - only for admin users
    ...(isAdmin ? [{ title: "Artists", href: "/artists", icon: Users }] : []),
    { title: "File Sharing", href: "/file-sharing", icon: Share2 },
    { title: "Collections", href: "/collections", icon: FolderOpen },
    // Appointments - available to all users
    { title: "Appointments", href: "/appointments", icon: Calendar },
    { title: "Locations", href: "/locations", icon: MapPin },
    // CRM - only for admin users
    ...(isAdmin ? [{ title: "CRM", href: "/crm", icon: UserCheck }] : []),
    // Projects - only for admin users
    ...(isAdmin ? [{ title: "Projects", href: "/projects", icon: Building2 }] : []),
    // Admin settings - only for admin users
    ...(isAdmin ? [{ title: "Admin", href: "/admin", icon: Settings }] : [])
  ];

  return baseItems;
};
