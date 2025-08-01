import { useLocation } from "react-router-dom";
import { Home, Palette, Users, FileText, Calendar, MapPin, FolderOpen, Share2, Settings, Archive, MessageCircle } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const mainNavItems = [
  { href: "/", icon: Home, name: "Dashboard" },
  { href: "/artworks", icon: Palette, name: "Artworks" },
  { href: "/artists", icon: Users, name: "Artists" },
  { href: "/collections", icon: FolderOpen, name: "Collections" },
  { href: "/file-sharing", icon: Share2, name: "File Sharing" },
  { href: "/locations", icon: MapPin, name: "Locations" },
  { href: "/appointments", icon: Calendar, name: "Appointments" },
  { href: "/chat", icon: MessageCircle, name: "Chat" },
];

const adminNavItems = [
  { href: "/crm", icon: Users, name: "CRM" },
  { href: "/projects", icon: Archive, name: "Projects" },
  { href: "/admin", icon: Settings, name: "Admin" },
];

export function AppSidebar() {
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const userInitials = user?.email ? user.email.slice(0, 2).toUpperCase() : "U";

  return (
    <Sidebar className="border-r" collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-2">
          {!isCollapsed && (
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              ArtFlow
            </h1>
          )}
          {isCollapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <span className="text-sm font-bold">A</span>
            </div>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={isCollapsed ? item.name : undefined}
                  >
                    <NavLink to={item.href}>
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.name}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={isCollapsed ? item.name : undefined}
                    >
                      <NavLink to={item.href}>
                        <item.icon className="h-4 w-4" />
                        {!isCollapsed && <span>{item.name}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt={user?.email || "User"} />
            <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 text-left">
              <p className="text-sm font-medium leading-none text-sidebar-foreground">
                {user?.email?.split('@')[0] || "User"}
              </p>
              <p className="text-xs text-sidebar-foreground/70">
                {user?.email || "user@example.com"}
              </p>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}