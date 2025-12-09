import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "react-router-dom";
import { 
  Users, 
  Building2, 
  ListChecks, 
  Mail, 
  Kanban
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const crmNavItems = [
  { href: "/crm", icon: Users, label: "Contacts", end: true },
  { href: "/crm/organizations", icon: Building2, label: "Organizations" },
  { href: "/crm/lists", icon: ListChecks, label: "Lists & Segments" },
  { href: "/crm/campaigns", icon: Mail, label: "Campaigns" },
  { href: "/crm/pipelines", icon: Kanban, label: "Pipelines" },
];

export default function CRMLayout() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* CRM Top Navigation */}
      <div className="border-b border-border bg-muted/30 px-4 py-2 flex items-center gap-1">
        <TooltipProvider>
          {crmNavItems.map((item) => (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.href}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-center w-10 h-10 transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )
                  }
                >
                  <item.icon className="h-5 w-5" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{item.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
