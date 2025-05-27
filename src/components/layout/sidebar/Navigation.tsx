
import { SidebarNavItem } from "@/components/layout/sidebar/components/SidebarNavItem"; // Changed NavItem to SidebarNavItem
import {
  Palette, Users, Landmark, Calendar, Folder, FileText, Settings, UploadCloud, Link2, Database, FileUp
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Navigation = () => {
  const { user, isAdmin } = useAuth();

  const navItems = [
    { href: "/", icon: Palette, name: "Dashboard" }, // Changed label to name
    { href: "/artworks", icon: Palette, name: "Artworks" }, // Changed label to name
    { href: "/artists", icon: Users, name: "Artists" }, // Changed label to name
    { href: "/collections", icon: Folder, name: "Collections" }, // Changed label to name
    { href: "/projects", icon: Calendar, name: "Projects" }, // Changed label to name
    { href: "/locations", icon: Landmark, name: "Locations" }, // Changed label to name
    { href: "/documents", icon: FileText, name: "Documents" }, // Changed label to name
    { href: "/manage-websites", icon: Link2, name: "Websites" , adminOnly: true }, // Changed label to name
    { type: "divider", adminOnly: true },
    { href: "/upload", icon: UploadCloud, name: "Upload Assets", adminOnly: true }, // Changed label to name
    { href: "/file-transfer", icon: FileUp, name: "File Transfers", adminOnly: true }, // Changed label to name
    { href: "/backup", icon: Database, name: "Backup & Export", adminOnly: true }, // Changed label to name
    { type: "divider" },
    { href: "/profile", icon: Settings, name: "My Profile" }, // Changed label to name
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return isAdmin;
    }
    return true;
  });

  return (
    <nav className="flex-1 space-y-1 px-2 py-4">
      {filteredNavItems.map((item, index) =>
        item.type === "divider" ? (
          <hr key={`divider-${index}`} className="my-3 border-gray-200 dark:border-gray-700" />
        ) : (
          <SidebarNavItem key={item.href} href={item.href!} icon={item.icon!} name={item.name!} /> // Changed label to name
        )
      )}
    </nav>
  );
};
