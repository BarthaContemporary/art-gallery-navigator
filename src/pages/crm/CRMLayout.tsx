import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";
import { 
  Users, 
  Building2, 
  ListChecks, 
  Mail, 
  Kanban, 
  Settings,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const crmNavItems = [
  { href: "/crm", icon: Users, label: "Contacts", end: true },
  { href: "/crm/organizations", icon: Building2, label: "Organizations" },
  { href: "/crm/lists", icon: ListChecks, label: "Lists & Segments" },
  { href: "/crm/campaigns", icon: Mail, label: "Campaigns" },
  { href: "/crm/pipelines", icon: Kanban, label: "Pipelines" },
  { href: "/crm/settings", icon: Settings, label: "Settings" },
];

export default function CRMLayout() {
  const { isAdmin } = useAuth();
  const location = useLocation();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-full">
      {/* CRM Sub-navigation */}
      <aside className="w-44 border-r border-border bg-muted/30 flex-shrink-0">
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold text-lg">CRM</h2>
          <p className="text-xs text-muted-foreground">Manage contacts & relationships</p>
        </div>
        <nav className="p-1.5 space-y-0.5">
          {crmNavItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
