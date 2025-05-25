
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
} from "lucide-react";
import { useAuth } from "./use-auth";

export type NavItem = {
  name: string;
  icon: any;
  href: string;
};

const BASE_NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    name: "Artists",
    icon: Users,
    href: "/artists",
  },
  {
    name: "Artworks",
    icon: Image,
    href: "/artworks",
  },
  {
    name: "Collections",
    icon: List,
    href: "/collections",
  },
  // Project Nav Item will be added conditionally below
  {
    name: "Locations",
    icon: MapPin,
    href: "/locations",
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
];

export function useNavItems() {
  const { isAdmin, isArtist, isExternal } = useAuth();
  
  let navItems = [...BASE_NAV_ITEMS];

  if (isAdmin) {
    // Add Projects only for admins
    // Find index of "Collections" to insert "Projects" after it
    const collectionsIndex = navItems.findIndex(item => item.name === "Collections");
    if (collectionsIndex !== -1) {
      navItems.splice(collectionsIndex + 1, 0, {
        name: "Projects",
        icon: Calendar,
        href: "/projects",
      });
    } else { // Fallback if "Collections" isn't found, add to end
      navItems.push({
        name: "Projects",
        icon: Calendar,
        href: "/projects",
      });
    }

    navItems.push({
      name: "User Management",
      icon: Shield,
      href: "/signup",
    });
  }

  // Remove Locations tab for external users
  navItems = navItems.filter(item => {
    if (item.name === "Locations") {
      return !isExternal;
    }
    return true;
  });

  return navItems;
}

