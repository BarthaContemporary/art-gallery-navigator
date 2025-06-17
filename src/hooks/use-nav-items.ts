
import { Calendar, Users, Home, PaintBucket, FileText, MapPin, FolderOpen, Building2, UserCheck, Settings } from "lucide-react";
import { useAuth } from "./use-auth";

export const useNavItems = () => {
  const { isAdmin } = useAuth();

  const baseItems = [
    { title: "Dashboard", href: "/", icon: Home },
    ...(isAdmin ? [{ title: "CRM", href: "/crm", icon: UserCheck }] : []),
    { title: "Artworks", href: "/artworks", icon: PaintBucket },
    { title: "Artists", href: "/artists", icon: Users },
    { title: "Collections", href: "/collections", icon: FolderOpen },
    { title: "Documents", href: "/documents", icon: FileText },
    { title: "Locations", href: "/locations", icon: MapPin },
    { title: "Projects", href: "/projects", icon: Building2 },
    { title: "Appointments", href: "/appointments", icon: Calendar },
    ...(isAdmin ? [{ title: "Settings", href: "/settings", icon: Settings }] : [])
  ];

  return baseItems;
};
