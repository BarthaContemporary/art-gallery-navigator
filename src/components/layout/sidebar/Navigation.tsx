
import { SidebarNavItem } from "@/components/layout/sidebar/components/SidebarNavItem";
import { CompendiumTreeView } from "@/components/layout/sidebar/CompendiumTreeView";
import { useNavItems } from '@/hooks/use-nav-items';
import { Separator } from "@/components/ui/separator";

export const Navigation = () => {
  const navItems = useNavItems();

  return (
    <nav className="flex-1 space-y-4 px-2 py-4">
      {/* Regular navigation items */}
      <div className="space-y-1">
        {navItems.map((item) => (
          <SidebarNavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            name={item.title}
          />
        ))}
      </div>
      
      <Separator />
      
      {/* Tree view compendium */}
      <CompendiumTreeView />
    </nav>
  );
};
