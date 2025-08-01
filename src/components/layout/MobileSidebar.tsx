
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavItemsGrouped } from "@/hooks/use-nav-items";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { signOut, isAdmin } = useAuth();
  const { mainItems, adminItems } = useNavItemsGrouped();

  return (
    <>
      {/* Fixed mobile header - optimized for iPhone screens */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-12 z-50 flex items-center justify-between px-4 safe-area-top"> {/* Updated: removed border-b and bg-white */}
        <Link to="/" className="flex items-center">
          <img
            src="https://cdn.prod.website-files.com/641c45e709414b1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg"
            alt="Bartha Logo"
            className="h-5 w-auto max-w-[100px]"
          />
        </Link>
        
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Open menu" className="h-8 w-8 p-0">
              <Menu className="h-4 w-4" />
            </Button>
          </DrawerTrigger>
          
          <DrawerContent className="h-[75vh] mt-12 bg-white safe-area-bottom">
            <div className="flex flex-col h-full bg-white">
              {/* Header with close button */}
              <div className="flex items-center justify-between px-4 py-3 bg-white"> {/* Updated: removed border-b */}
                <h2 className="text-base font-semibold">Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Navigation items */}
              <nav className="flex-1 py-2 px-4 overflow-y-auto bg-white">
                {/* Main navigation items */}
                <div className="space-y-1">
                  {mainItems.map((item) => (
                    <Link
                      to={item.href}
                      key={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-3 text-sm transition-colors ${
                        location.pathname === item.href || 
                        (item.href !== "/" && location.pathname.startsWith(item.href))
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      <span className="font-normal">{item.title}</span>
                    </Link>
                  ))}
                </div>

                {/* Admin section */}
                {isAdmin && adminItems.length > 0 && (
                  <>
                    <div className="pt-4 pb-2">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">
                        Admin
                      </p>
                    </div>
                    <div className="space-y-1">
                      {adminItems.map((item) => (
                        <Link
                          to={item.href}
                          key={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 px-3 py-3 text-sm transition-colors ${
                            location.pathname === item.href || 
                            (item.href !== "/" && location.pathname.startsWith(item.href))
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <item.icon className="w-4 h-4 flex-shrink-0" />
                          <span className="font-normal">{item.title}</span>
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </nav>
              
              {/* Logout button */}
              <div className="p-4 bg-white safe-area-bottom"> {/* Updated: removed border-t */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                  className="w-full justify-start gap-3 h-11"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-sm font-normal">Logout</span>
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
