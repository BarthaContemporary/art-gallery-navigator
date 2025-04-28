
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavItems } from "@/hooks/use-nav-items"; 

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { signOut } = useAuth();
  const navItems = useNavItems();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="p-0 flex flex-col h-[96vh]">
        {/* Add mt-12 for top spacing and adjust header */}
        <div className="flex items-center justify-between border-b px-4 py-4 mt-12">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
          <img
            src="https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg"
            alt="Bartha Logo"
            className="h-7 w-auto"
            style={{ maxWidth: 120 }}
          />
        </div>
        <nav className="flex-1 py-6 px-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              to={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
              className={
                location.pathname === item.href || 
                (item.href !== "/" && location.pathname.startsWith(item.href))
                  ? "flex items-center gap-3 rounded-md px-3 py-3 text-base transition-colors bg-primary text-primary-foreground"
                  : "flex items-center gap-3 rounded-md px-3 py-3 text-base transition-colors hover:bg-secondary hover:text-secondary-foreground"
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={signOut}
            className="w-full gap-2 justify-start"
          >
            <span className="flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Logout
            </span>
          </Button>
        </div>
      </DrawerContent>
      {/* Move trigger to top-right and add spacing */}
      <div className="absolute top-3 right-3 z-40">
        <DrawerTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu">
            <Menu />
          </Button>
        </DrawerTrigger>
      </div>
      {/* Add the B_c Logo at the top-right */}
      <div className="fixed top-3 right-16 z-40">
        <img
          src="https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg"
          alt="Bartha Logo"
          className="h-7 w-auto"
          style={{ maxWidth: 120 }}
        />
      </div>
    </Drawer>
  );
}
