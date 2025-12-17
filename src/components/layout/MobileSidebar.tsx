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
      {/* Fixed mobile header - Apple style */}
      <div className="sm:hidden fixed top-0 left-0 right-0 h-12 z-50 flex items-center justify-between px-4 safe-area-top glass">
        <Link to="/" className="flex items-center">
          <img
            src="https://cdn.prod.website-files.com/641c45e709414c1f712574c2/64242806807e29000ba8b7cc_bartha_logo.svg"
            alt="Bartha Logo"
            className="h-5 w-auto max-w-[100px]"
          />
        </Link>
        
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Open menu" className="h-9 w-9 p-0 rounded-full">
              <Menu className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          
          <DrawerContent className="h-[80vh] bg-background safe-area-bottom">
            <div className="flex flex-col h-full">
              {/* Header with close button */}
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="text-[17px] font-semibold">Menu</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="h-9 w-9 p-0 rounded-full bg-secondary/80 hover:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Navigation items */}
              <nav className="flex-1 py-2 px-4 overflow-y-auto">
                {/* Main navigation items */}
                <div className="space-y-1">
                  {mainItems.map((item) => {
                    const isActive = location.pathname === item.href || 
                      (item.href !== "/" && location.pathname.startsWith(item.href));
                    return (
                      <Link
                        to={item.href}
                        key={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3.5 text-[15px] transition-all duration-200 rounded-xl ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "hover:bg-secondary active:bg-secondary-hover active:scale-[0.98]"
                        }`}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Admin section */}
                {isAdmin && adminItems.length > 0 && (
                  <>
                    <div className="pt-6 pb-2">
                      <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider px-4">
                        Admin
                      </p>
                    </div>
                    <div className="space-y-1">
                      {adminItems.map((item) => {
                        const isActive = location.pathname === item.href || 
                          (item.href !== "/" && location.pathname.startsWith(item.href));
                        return (
                          <Link
                            to={item.href}
                            key={item.href}
                            onClick={() => setOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3.5 text-[15px] transition-all duration-200 rounded-xl ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "hover:bg-secondary active:bg-secondary-hover active:scale-[0.98]"
                            }`}
                          >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </nav>
              
              {/* Logout button */}
              <div className="p-5 safe-area-bottom">
                <Button 
                  variant="secondary" 
                  size="lg"
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                  className="w-full justify-center gap-3 rounded-xl"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[15px] font-medium">Sign Out</span>
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}