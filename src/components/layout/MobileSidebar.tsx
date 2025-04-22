
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Menu, X, Users, Palette, MapPin, FileText, LayoutDashboard, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();

  const navigationItems = [
    { title: "Dashboard", icon: <LayoutDashboard size={20} />, path: "/" },
    { title: "Artists", icon: <Users size={20} />, path: "/artists" },
    { title: "Artworks", icon: <Palette size={20} />, path: "/artworks" },
    { title: "Locations", icon: <MapPin size={20} />, path: "/locations" },
    { title: "Documents", icon: <FileText size={20} />, path: "/documents" },
  ];

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <div className="absolute top-3 left-3 z-40">
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu />
          </Button>
        </DrawerTrigger>
      </div>
      <DrawerContent className="p-0 flex flex-col h-[96vh]">
        <div className="flex items-center justify-between border-b px-4 py-4">
          <img
            src="https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg"
            alt="Bartha Logo"
            className="h-7 w-auto"
            style={{ maxWidth: 120 }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>
        <nav className="flex-1 py-6 px-4 flex flex-col gap-2">
          {navigationItems.map((item) => (
            <NavLink
              to={item.path}
              key={item.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-3 text-base transition-colors ${
                  isActive || location.pathname === item.path
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary hover:text-secondary-foreground"
                }`
              }
            >
              {item.icon}
              {item.title}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={signOut}
            className="w-full gap-2 justify-start"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
