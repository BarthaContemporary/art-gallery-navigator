import { useAuth } from "@/contexts/auth-context";
import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LucideIcon,
  MapPin,
  Users,
  Tag,
  Image,
  FileText,
  Settings,
  BarChart,
} from "lucide-react";
import { useUserRoles } from "./use-user-roles";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const useNavItems = () => {
  const { user } = useAuth();
  const { data: userRoles } = useUserRoles(user?.id);

  const isAdmin = userRoles?.some(role => role.role === 'gallery_admin');

  return [
    {
      title: "Dashboard",
      url: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Artworks",
      url: "/artworks",
      icon: Image,
    },
    {
      title: "Artists",
      url: "/artists",
      icon: Users,
    },
    {
      title: "Exhibitions",
      url: "/exhibitions",
      icon: MapPin,
    },
    {
      title: "Collections",
      url: "/collections",
      icon: ClipboardList,
    },
    {
      title: "Sales",
      url: "/sales",
      icon: Tag,
    },
    {
      title: "Projects",
      url: "/projects",
      icon: ListChecks,
    },
    {
      title: "Documents",
      url: "/documents",
      icon: FileText,
    },
    {
      title: "Reports",
      url: "/reports",
      icon: BarChart,
      adminOnly: true,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings,
      adminOnly: true,
    },
    {
      title: "Appointments",
      url: "/appointments",
      icon: Calendar,
      adminOnly: true,
    },
  ].filter(item => !item.adminOnly || isAdmin);
};
