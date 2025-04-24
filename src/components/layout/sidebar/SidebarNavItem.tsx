
import React from 'react';
import { useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface SidebarNavItemProps {
  href: string;
  icon: LucideIcon;
  name: string;
}

export function SidebarNavItem({ href, icon: Icon, name }: SidebarNavItemProps) {
  const location = useLocation();
  const isActive =
    location.pathname === href ||
    (href !== "/" && location.pathname.startsWith(href));

  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors
        ${
          isActive
            ? "bg-primary text-primary-foreground shadow"
            : "hover:bg-accent hover:text-accent-foreground text-gray-800"
        }`}
      style={{ fontWeight: isActive ? 600 : 500 }}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span>{name}</span>
    </a>
  );
}
