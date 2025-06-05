
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
    <>
      {/* Fixed mobile header - only visible on mobile */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b z-50 flex items-center justify-between px-3">
        <Link to="/" className="flex items-center">
          <img
            src="https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg"
            alt="Bartha Logo"
            className="h-6 w-auto"
            style={{ maxWidth: 120 }}
          />
        </Link>
        
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          
          <DrawerContent className="h-[70vh] mt-14 bg-white">
            <div className="flex flex-col h-full bg-white">
              {/* Header with close button */}
              <div className="flex items-center justify-between border-b px-3 py-2 bg-white">
                <h2 className="text-base font-semibold">Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Navigation items */}
              <nav className="flex-1 py-2 px-3 overflow-y-auto bg-white">
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <Link
                      to={item.href}
                      key={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                        location.pathname === item.href || 
                        (item.href !== "/" && location.pathname.startsWith(item.href))
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              </nav>
              
              {/* Logout button */}
              <div className="border-t p-3 bg-white">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                  className="w-full justify-start gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm">Logout</span>
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
