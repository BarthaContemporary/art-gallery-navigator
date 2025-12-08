
import { Calendar, Users, Home, PaintBucket, Share2, MapPin, FolderOpen, Building2, UserCheck, Settings, Image } from "lucide-react";
import { useAuth } from "./use-auth";

export const useNavItems = () => {
  const { isAdmin, isArtist } = useAuth();

  const mainItems = [
    // Dashboard - only for admin users
    ...(isAdmin ? [{ title: "Dashboard", href: "/", icon: Home }] : []),
    { title: "Artworks", href: "/artworks", icon: PaintBucket },
    // Artists - only for admin users
    ...(isAdmin ? [{ title: "Artists", href: "/artists", icon: Users }] : []),
    { title: "Collections", href: "/collections", icon: FolderOpen },
    { title: "File Sharing", href: "/file-sharing", icon: Share2 },
    { title: "Locations", href: "/locations", icon: MapPin },
    // Appointments - available to all users
    { title: "Appointments", href: "/appointments", icon: Calendar },
  ];

  const adminItems = isAdmin ? [
    { title: "CRM", href: "/crm", icon: UserCheck },
    { title: "Projects", href: "/projects", icon: Building2 },
    { title: "Image Viewer", href: "/viewer", icon: Image },
    { title: "Admin", href: "/admin", icon: Settings }
  ] : [];

  // For backward compatibility, return flat array
  const baseItems = [...mainItems, ...adminItems];

  return baseItems;
};

export const useNavItemsGrouped = () => {
  const { isAdmin } = useAuth();

  const mainItems = [
    // Dashboard - only for admin users
    ...(isAdmin ? [{ title: "Dashboard", href: "/", icon: Home }] : []),
    { title: "Artworks", href: "/artworks", icon: PaintBucket },
    // Artists - only for admin users
    ...(isAdmin ? [{ title: "Artists", href: "/artists", icon: Users }] : []),
    { title: "Collections", href: "/collections", icon: FolderOpen },
    { title: "File Sharing", href: "/file-sharing", icon: Share2 },
    { title: "Locations", href: "/locations", icon: MapPin },
    // Appointments - available to all users
    { title: "Appointments", href: "/appointments", icon: Calendar },
  ];

  const adminItems = isAdmin ? [
    { title: "CRM", href: "/crm", icon: UserCheck },
    { title: "Projects", href: "/projects", icon: Building2 },
    { title: "Image Viewer", href: "/viewer", icon: Image },
    { title: "Admin", href: "/admin", icon: Settings }
  ] : [];

  return { mainItems, adminItems };
};
