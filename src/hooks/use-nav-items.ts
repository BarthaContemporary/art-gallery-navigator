
import { Calendar, Users, PaintBucket, Share2, MapPin, FolderOpen, Building2, UserCheck, Settings, Image, BookOpen } from "lucide-react";
import { useAuth } from "./use-auth";

export const useNavItems = () => {
  const { isAdmin } = useAuth();

  const baseItems = [
    { title: "Artworks", href: "/artworks", icon: PaintBucket },
    { title: "Collections", href: "/collections", icon: FolderOpen },
    ...(isAdmin ? [
      { title: "CRM", href: "/crm", icon: UserCheck },
      { title: "Projects", href: "/projects", icon: Building2 },
      { title: "Image Viewer", href: "/viewer", icon: Image },
      { title: "Publications", href: "/admin/publications", icon: BookOpen },
    ] : []),
    { title: "File Sharing", href: "/file-sharing", icon: Share2 },
    { title: "Appointments", href: "/appointments", icon: Calendar },
    ...(isAdmin ? [
      { title: "Artists", href: "/artists", icon: Users },
    ] : []),
    { title: "Locations", href: "/locations", icon: MapPin },
    ...(isAdmin ? [
      { title: "Admin", href: "/admin", icon: Settings },
    ] : []),
  ];

  return baseItems;
};

export const useNavItemsGrouped = () => {
  const { isAdmin } = useAuth();

  const mainItems = [
    { title: "Artworks", href: "/artworks", icon: PaintBucket },
    { title: "Collections", href: "/collections", icon: FolderOpen },
    ...(isAdmin ? [
      { title: "CRM", href: "/crm", icon: UserCheck },
      { title: "Projects", href: "/projects", icon: Building2 },
      { title: "Image Viewer", href: "/viewer", icon: Image },
      { title: "Publications", href: "/admin/publications", icon: BookOpen },
    ] : []),
    { title: "File Sharing", href: "/file-sharing", icon: Share2 },
    { title: "Appointments", href: "/appointments", icon: Calendar },
    ...(isAdmin ? [
      { title: "Artists", href: "/artists", icon: Users },
    ] : []),
    { title: "Locations", href: "/locations", icon: MapPin },
  ];

  const adminItems = isAdmin ? [
    { title: "Admin", href: "/admin", icon: Settings }
  ] : [];

  return { mainItems, adminItems };
};
