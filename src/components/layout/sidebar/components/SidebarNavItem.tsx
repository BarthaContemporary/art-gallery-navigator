
import React from 'react';
import { useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { SidebarMenuButton } from "@/components/ui/sidebar";

interface SidebarNavItemProps {
  href: string;
  icon: LucideIcon;
  name: string;
}

export function SidebarNavItem({ href, icon: Icon, name }: SidebarNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === href || 
    (href !== "/" && location.pathname.startsWith(href));

  return (
    <SidebarMenuButton
      asChild
      className={`flex items-center gap-3 w-full no-underline font-medium
        ${isActive ? "bg-primary text-primary-foreground shadow" : "text-gray-800"}
      `}
    >
      <a 
        href={href}
        className="no-underline hover:no-underline active:no-underline focus:no-underline"
        style={{ fontWeight: isActive ? 600 : 500 }}
      >
        <Icon className="w-5 h-5 shrink-0" />
        <span>{name}</span>
      </a>
    </SidebarMenuButton>
  );
}
