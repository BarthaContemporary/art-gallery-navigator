import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Users, 
  Palette, 
  MapPin, 
  FileText, 
  LayoutDashboard,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarItemProps {
  icon: React.ReactNode;
  title: string;
  path: string;
  isCollapsed: boolean;
}

const SidebarItem = ({ icon, title, path, isCollapsed }: SidebarItemProps) => (
  <NavLink
    to={path}
    className={({ isActive }) =>
      cn(
        "flex items-center py-3 px-4 rounded-md transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "hover:bg-secondary hover:text-secondary-foreground",
        isCollapsed ? "justify-center" : ""
      )
    }
  >
    <div className="flex items-center">
      <div className={cn("h-5 w-5", !isCollapsed && "mr-3")}>{icon}</div>
      {!isCollapsed && <span>{title}</span>}
    </div>
  </NavLink>
);

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navigationItems = [
    { title: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/" },
    { title: "Artists", icon: <Users size={20} />, path: "/artists" },
    { title: "Artworks", icon: <Palette size={20} />, path: "/artworks" },
    { title: "Locations", icon: <MapPin size={20} />, path: "/locations" },
    { title: "Documents", icon: <FileText size={20} />, path: "/documents" },
  ];

  return (
    <div
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <h1 className="text-xl font-semibold text-sidebar-foreground">
            Gallery Admin
          </h1>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="ml-auto"
        >
          {isCollapsed ? <Menu size={20} /> : <X size={20} />}
        </Button>
      </div>
      <nav className="flex-1 pt-4 px-2">
        {navigationItems.map((item) => (
          <SidebarItem
            key={item.path}
            icon={item.icon}
            title={item.title}
            path={item.path}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        {!isCollapsed && (
          <p className="text-xs text-sidebar-foreground opacity-60">
            Art Gallery Inventory
          </p>
        )}
      </div>
    </div>
  );
}
