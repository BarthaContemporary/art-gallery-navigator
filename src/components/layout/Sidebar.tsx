
import {
  LayoutDashboard,
  Users,
  Image,
  MapPin,
  File,
  List,
  Settings,
  User,
  Shield,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import React from "react";

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

export function Sidebar() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Create a mutable copy of the nav items array
  const sidebarNavItems = [...NAV_ITEMS];
  
  // Add User Signup item for admins
  if (isAdmin) {
    sidebarNavItems.push({
      name: "User Signup",
      icon: Shield,
      href: "/signup",
    });
  }

  const LOGO_SRC =
    "https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg";

  return (
    <aside
      className="hidden sm:flex flex-col w-60 h-full border-r bg-gradient-to-b from-[#f9fafb] via-[#edf0f4] to-[#e3e6ed] dark:from-sidebar-background dark:via-sidebar-background dark:to-[#1f232d] shadow-md"
      style={{
        minHeight: "100vh",
      }}
    >
      <div className="flex items-center pl-4 h-16 border-b mb-2">
        <img
          className="h-9 w-auto"
          src={LOGO_SRC}
          alt="Gallery Logo"
          style={{ maxWidth: 120 }}
        />
      </div>
      <nav className="flex-1 flex flex-col px-3 py-2 gap-2">
        <div className="font-medium text-xs text-muted-foreground px-2 pt-1 pb-2 tracking-wide uppercase">
          Menu
        </div>
        {sidebarNavItems.map((item) => {
          const isActive =
            location.pathname === item.href ||
            (item.href !== "/" && location.pathname.startsWith(item.href));
          return (
            <a
              href={item.href}
              key={item.name}
              className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors
              ${
                isActive
                  ? "bg-primary text-primary-foreground shadow"
                  : "hover:bg-accent hover:text-accent-foreground text-gray-800 dark:text-sidebar-foreground"
              }`}
              style={{ fontWeight: isActive ? 600 : 500 }}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.name}</span>
            </a>
          );
        })}
        <div className="flex-1" />
      </nav>
      <div className="border-t px-4 py-4 mt-auto bg-white/60 dark:bg-[#181b21]/80">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata.avatar_url} />
                  <AvatarFallback>
                    {user?.email?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold truncate max-w-[100px]">
                  {user?.email}
                </span>
              </div>
              <Settings className="h-4 w-4 text-muted-foreground ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-30 min-w-[180px] shadow-lg bg-white dark:bg-[#232630]">
            <DropdownMenuLabel className="text-xs">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate("/profile")}
              className="cursor-pointer"
            >
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="cursor-pointer text-destructive"
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
