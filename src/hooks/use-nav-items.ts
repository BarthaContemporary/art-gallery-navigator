
import { useAuth } from "@/hooks/use-auth";
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
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const useNavItems = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRoles(user);

  return [
    {
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      title: "Artworks",
      href: "/artworks",
      icon: Image,
    },
    {
      title: "Artists",
      href: "/artists",
      icon: Users,
    },
    {
      title: "Collections",
      href: "/collections",
      icon: ClipboardList,
    },
    {
      title: "Documents",
      href: "/documents",
      icon: FileText,
    },
    {
      title: "Projects",
      href: "/projects",
      icon: ListChecks,
    },
    {
      title: "Locations",
      href: "/locations",
      icon: MapPin,
    },
    {
      title: "Appointments",
      href: "/appointments",
      icon: Calendar,
      adminOnly: true,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
      adminOnly: true,
    },
  ].filter(item => !item.adminOnly || isAdmin);
};
