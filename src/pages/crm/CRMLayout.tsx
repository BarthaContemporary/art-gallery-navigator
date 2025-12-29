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
  { href: "/crm/pipelines", icon: Kanban, label: "Pipelines" },
  { href: "/crm", icon: Users, label: "Contacts", end: true },
  { href: "/crm/organizations", icon: Building2, label: "Organisations" },
  { href: "/crm/lists", icon: ListChecks, label: "Lists & Segments" },
  { href: "/crm/campaigns", icon: Mail, label: "Campaigns" },
];

export default function CRMLayout() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* CRM Top Navigation - minimal, integrated design */}
      <div className="border-b border-border/50 bg-background px-4 h-11 flex items-center">
        <TooltipProvider delayDuration={200}>
          <nav className="flex items-center gap-0.5">
            {crmNavItems.map((item) => (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.href}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center justify-center w-9 h-9 transition-all duration-200",
                        "text-muted-foreground hover:text-foreground",
                        isActive && [
                          "text-primary",
                          "after:absolute after:bottom-[-6px] after:left-1/2 after:-translate-x-1/2",
                          "after:w-5 after:h-0.5 after:bg-primary"
                        ]
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px]" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
