
import { NavItem } from "@/components/layout/sidebar/components/SidebarNavItem";
import {
  Palette, Users, Landmark, Calendar, Folder, FileText, Settings, UploadCloud, Link2, Database, FileUp // Added Database, FileUp
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Navigation = () => {
  const { user, isAdmin } = useAuth();

  const navItems = [
    { href: "/", icon: Palette, label: "Dashboard" },
    { href: "/artworks", icon: Palette, label: "Artworks" },
    { href: "/artists", icon: Users, label: "Artists" },
    { href: "/collections", icon: Folder, label: "Collections" },
    { href: "/projects", icon: Calendar, label: "Projects" },
    { href: "/locations", icon: Landmark, label: "Locations" },
    { href: "/documents", icon: FileText, label: "Documents" },
    { href: "/manage-websites", icon: Link2, label: "Websites" , adminOnly: true },
    { type: "divider", adminOnly: true },
    { href: "/upload", icon: UploadCloud, label: "Upload Assets", adminOnly: true },
    { href: "/file-transfer", icon: FileUp, label: "File Transfers", adminOnly: true }, // Using FileUp for File Transfers
    { href: "/backup", icon: Database, label: "Backup & Export", adminOnly: true }, // Added Backup & Export link
    { type: "divider" },
    { href: "/profile", icon: Settings, label: "My Profile" },
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
          <NavItem key={item.href} href={item.href!} icon={item.icon!} label={item.label!} />
        )
      )}
    </nav>
  );
};
