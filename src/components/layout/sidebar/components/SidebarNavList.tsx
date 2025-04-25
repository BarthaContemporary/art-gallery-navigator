
import React from 'react';
import { useNavItems } from '@/hooks/use-nav-items';
import { SidebarNavItem } from './SidebarNavItem';

export function SidebarNavList() {
  const navItems = useNavItems();

  return (
    <nav className="flex-1 flex flex-col px-3 py-2 gap-2">
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.name}
          href={item.href}
          icon={item.icon}
          name={item.name}
        />
      ))}
      <div className="flex-1" />
    </nav>
  );
}
