import {
  LayoutDashboard,
  Users,
  Image,
  MapPin,
  File,
  List,
  Shield,
  Upload,
  Calendar,
  Settings,
  UploadCloud,
  Database,
  Link2,
} from "lucide-react";
import { useAuth } from "./use-auth";

export type NavItem = {
  name: string;
  icon: any;
  href: string;
  adminOnly?: boolean;
  externalHide?: boolean;
};

const BASE_NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    name: "Artworks",
    icon: Image,
    href: "/artworks",
  },
  {
    name: "Artists",
    icon: Users,
    href: "/artists",
  },
  {
    name: "Collections",
    icon: List,
    href: "/collections",
  },
  {
    name: "Locations",
    icon: MapPin,
    href: "/locations",
    externalHide: true,
  },
  {
    name: "Documents",
    icon: File,
    href: "/documents",
  },
  {
    name: "File Transfer",
    icon: Upload,
    href: "/file-transfer",
  },
  {
    name: "My Profile",
    icon: Settings,
    href: "/profile",
  },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    name: "Projects",
    icon: Calendar,
    href: "/projects",
    adminOnly: true,
  },
  {
    name: "Upload Assets",
    icon: UploadCloud,
    href: "/upload",
    adminOnly: true,
  },
  {
    name: "Manage Websites",
    icon: Link2,
    href: "/manage-websites",
    adminOnly: true,
  },
  {
    name: "Backup & Export",
    icon: Database,
    href: "/backup",
    adminOnly: true,
  },
  {
    name: "User Management",
    icon: Shield,
    href: "/signup",
    adminOnly: true,
  },
];

export function useNavItems() {
  const { isAdmin, isExternal } = useAuth();
  
  let navItems = [...BASE_NAV_ITEMS];

  if (isAdmin) {
    const projectsItem = ADMIN_NAV_ITEMS.find(item => item.name === "Projects");
    if (projectsItem) {
      const collectionsIndex = navItems.findIndex(item => item.name === "Collections");
      if (collectionsIndex !== -1) {
        navItems.splice(collectionsIndex + 1, 0, projectsItem);
      } else {
        navItems.push(projectsItem);
      }
    }

    const otherAdminItems = ADMIN_NAV_ITEMS.filter(item => item.name !== "Projects");
    navItems.push(...otherAdminItems);
  }

  navItems = navItems.filter(item => {
    if (item.externalHide && isExternal) {
      return false;
    }
    if (item.adminOnly && !isAdmin) {
      return false;
    }
    return true;
  });

  return navItems;
}
