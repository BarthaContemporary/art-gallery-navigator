
import { Palette, Users, Landmark, Calendar, Folder } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/use-auth";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { InventoryStatusCard } from "@/components/dashboard/InventoryStatusCard";
import { AdminNotifications } from "@/components/dashboard/AdminNotifications";
import { StatsSummaryCards } from "@/components/dashboard/StatsSummaryCards";
import { CRMStatsCards } from "@/components/dashboard/CRMStatsCards";

const Dashboard = () => {
  const {
    data: stats,
    isLoading,
    error
  } = useDashboardStats();
  const {
    isAdmin
  } = useAuth();

  const statsCardsData = [{
    title: "Total Artworks",
    value: stats?.artworks_count ?? 0,
    icon: <Palette className="h-5 w-5" />,
    change: "Updated in real-time"
  }, {
    title: "Artists",
    value: stats?.artists_count ?? 0,
    icon: <Users className="h-5 w-5" />,
    change: "Active artists"
  }, {
    title: "Locations",
    value: stats?.locations_count ?? 0,
    icon: <Landmark className="h-5 w-5" />,
    change: "Gallery spaces"
  }, {
    title: "Projects",
    value: stats?.projects_count ?? 0,
    icon: <Calendar className="h-5 w-5" />,
    change: "Total projects"
  }, {
    title: "Collections",
    value: stats?.collections_count ?? 0,
    icon: <Folder className="h-5 w-5" />,
    change: "Created collections"
  }];

  const orderedStatuses = stats ? Object.entries(stats.inventory_statuses || {}).sort((a, b) => a[0].localeCompare(b[0])) : [];

  if (error) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader title="DASHBOARD" />
        <div className="text-red-500 p-4 border border-red-200 rounded-md mt-4">
          Error loading dashboard data. Please refresh the page or try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <PageHeader title="DASHBOARD" />

      {/* CRM Stats - Only visible to admin users */}
      {isAdmin && (
        <CRMStatsCards
          isLoading={isLoading}
          totalClients={stats?.total_clients_count ?? 0}
          activeClients={stats?.active_clients_count ?? 0}
          prospects={stats?.prospects_count ?? 0}
          customers={stats?.customers_count ?? 0}
          leads={stats?.leads_count ?? 0}
        />
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-0 mb-8">
        <RecentActivityCard isLoading={isLoading} activities={stats?.recent_activities} />
        <InventoryStatusCard isLoading={isLoading} orderedStatuses={orderedStatuses} />
      </div>

      {isAdmin && (
        <AdminNotifications 
          isLoading={isLoading} 
          pendingDeletionsCount={stats?.pending_deletions_count} 
          newUploadsCount={stats?.new_uploads_count} 
        />
      )}

      <StatsSummaryCards isLoading={isLoading} statsCardsData={statsCardsData} />
    </div>
  );
};
export default Dashboard;
