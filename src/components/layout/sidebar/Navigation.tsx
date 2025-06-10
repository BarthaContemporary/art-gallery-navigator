
import { SidebarNavItem } from "@/components/layout/sidebar/components/SidebarNavItem";
import { useNavItems } from '@/hooks/use-nav-items';

export const Navigation = () => {
  const navItems = useNavItems();

  return (
    <nav className="flex-1 space-y-1 px-2 py-4">
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.href}
          href={item.href}
          icon={item.icon}
          name={item.title}
        />
      ))}
    </nav>
  );
};
