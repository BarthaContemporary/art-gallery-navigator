
import {
  LayoutDashboard,
  Users,
  Image,
  MapPin,
  File,
  List,
  Shield,
  Upload,
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
  
  const navItems = [...BASE_NAV_ITEMS];
  
  if (isAdmin) {
    navItems.push({
      name: "User Management",
      icon: Shield,
      href: "/signup",
    });
  }

  // Remove Locations tab for external users
  return navItems.filter(item => 
    item.name !== "Locations" || !(isExternal) 
  );
}
