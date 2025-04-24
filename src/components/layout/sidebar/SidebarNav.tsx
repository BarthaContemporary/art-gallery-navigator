
import React from 'react';
import {
  LayoutDashboard,
  Users,
  Image,
  MapPin,
  File,
  List,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarNavItem } from './SidebarNavItem';

const NAV_ITEMS = [
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
];

export function SidebarNav() {
  const { isAdmin } = useAuth();
  const navItems = [...NAV_ITEMS];
  
  if (isAdmin) {
    navItems.push({
      name: "User Signup",
      icon: Shield,
      href: "/signup",
    });
  }

  return (
    <nav className="flex-1 flex flex-col px-3 py-2 gap-2">
      <div className="font-medium text-xs text-muted-foreground px-2 pt-1 pb-2 tracking-wide uppercase">
        Menu
      </div>
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.name}
          href={item.href}
          icon={item.icon}
          name={item.name}
        />
      ))}
      <div className="flex-1" />
    </nav>
  );
}
