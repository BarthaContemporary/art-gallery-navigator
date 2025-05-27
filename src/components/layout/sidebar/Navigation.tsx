
import { SidebarNavItem } from "@/components/layout/sidebar/components/SidebarNavItem";
import { useNavItems } from '@/hooks/use-nav-items'; // Changed import

export const Navigation = () => {
  const navItems = useNavItems(); // Use the hook

  return (
    <nav className="flex-1 space-y-1 px-2 py-4">
      {navItems.map((item) => (
        <SidebarNavItem
          key={item.href} // Use href as key assuming it's unique
          href={item.href}
          icon={item.icon}
          name={item.name}
        />
      ))}
    </nav>
  );
};
