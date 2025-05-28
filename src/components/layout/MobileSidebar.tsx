
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
      <div className="sm:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-50 flex items-center justify-between px-4">
        <Link to="/" className="flex items-center">
          <img
            src="https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg"
            alt="Bartha Logo"
            className="h-8 w-auto"
            style={{ maxWidth: 140 }}
          />
        </Link>
        
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          
          <DrawerContent className="h-[85vh] mt-16">
            <div className="flex flex-col h-full">
              {/* Header with close button */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-lg font-semibold">Menu</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Navigation items */}
              <nav className="flex-1 py-4 px-4 overflow-y-auto">
                <div className="space-y-2">
                  {navItems.map((item) => (
                    <Link
                      to={item.href}
                      key={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-3 text-base transition-colors ${
                        location.pathname === item.href || 
                        (item.href !== "/" && location.pathname.startsWith(item.href))
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  ))}
                </div>
              </nav>
              
              {/* Logout button */}
              <div className="border-t p-4">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                  className="w-full justify-start gap-3"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
