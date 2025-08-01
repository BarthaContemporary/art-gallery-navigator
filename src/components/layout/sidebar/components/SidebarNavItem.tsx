
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { getSidebarLinkClasses } from "@/lib/sidebar-utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface SidebarNavItemProps {
  href: string;
  icon: LucideIcon;
  name: string;
}

export function SidebarNavItem({
  href,
  icon: Icon,
  name
}: SidebarNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === href || href !== "/" && location.pathname.startsWith(href);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarMenuButton asChild className={`${getSidebarLinkClasses(isActive)} justify-center p-3 w-12 h-12`}>
            <Link to={href}>
              <Icon className="w-5 h-5" />
            </Link>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent side="right" className="ml-2">
          <p>{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
