
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Users, Landmark, Calendar, Folder, AlertCircle, FileUp } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { format } from "date-fns";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router-dom";

const STATUS_COLORS: Record<string, string> = {
  "available": "bg-green-500",
  "on hold": "bg-amber-500",
  "in transit": "bg-blue-500",
  "sold": "bg-blue-500",
  "consigned": "bg-purple-500",
  "not for sale": "bg-gray-500",
  "returned": "bg-black",
  "unknown": "bg-gray-300"
};

const ACTIVITY_COLORS: Record<string, string> = {
  "green": "bg-green-500",
  "amber": "bg-amber-500",
  "blue": "bg-blue-500",
  "purple": "bg-purple-500",
  "gray": "bg-gray-500",
  "red": "bg-red-500"
};

function getStatusLabel(status: string) {
  return status.split(' ').map(str => str.charAt(0).toUpperCase() + str.slice(1)).join(' ');
}

const Dashboard = () => {
  const { data: stats, isLoading, error } = useDashboardStats();
  const { isAdmin } = useAuth();
  
  const statsCards = [
    {
      title: "Total Artworks",
      value: stats?.artworks_count ?? 0,
      icon: <Palette className="h-5 w-5" />,
      change: "Updated in real-time"
    }, 
    {
      title: "Artists",
      value: stats?.artists_count ?? 0,
      icon: <Users className="h-5 w-5" />,
      change: "Active artists"
    }, 
    {
      title: "Locations",
      value: stats?.locations_count ?? 0,
      icon: <Landmark className="h-5 w-5" />,
      change: "Gallery spaces"
    },
    {
      title: "Projects",
      value: stats?.projects_count ?? 0,
      icon: <Calendar className="h-5 w-5" />,
      change: "Total projects"
    },
    {
      title: "Collections",
      value: stats?.collections_count ?? 0,
      icon: <Folder className="h-5 w-5" />,
      change: "Created collections"
    }
  ];

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.change}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Admin Notifications Section - Only visible to admins */}
      {isAdmin && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Admin Notifications</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <Link to="/documents" className="no-underline">
              <Card className={stats?.pending_deletions_count ? "border-amber-300 hover:border-amber-400 transition-colors" : ""}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Pending Deletion Requests
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats?.pending_deletions_count ?? 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.pending_deletions_count ? "Items awaiting review" : "No items awaiting review"}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>

            <Link to="/file-transfer" className="no-underline">
              <Card className={stats?.new_uploads_count ? "border-blue-300 hover:border-blue-400 transition-colors" : ""}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Recent File Uploads
                  </CardTitle>
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <FileUp className="h-5 w-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <>
                      <div className="text-2xl font-bold">
                        {stats?.new_uploads_count ?? 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {stats?.new_uploads_count ? "New files in last 7 days" : "No new files in last 7 days"}
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates to your gallery inventory</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex items-center gap-4">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <div className="w-full">
                      <Skeleton className="h-4 w-36 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {stats?.recent_activities && stats.recent_activities.length > 0 ? (
                  stats.recent_activities.map((activity, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className={`h-2 w-2 rounded-full ${ACTIVITY_COLORS[activity.color] || "bg-gray-400"}`}></div>
                      <div>
                        <p className="text-sm font-medium">{activity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(activity.timestamp), "MMMM d, yyyy 'at' HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-sm">No recent activities found.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Status</CardTitle>
            <CardDescription>Current status of artworks</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-3 rounded-full" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {orderedStatuses.length > 0 ? (
                  orderedStatuses.map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${STATUS_COLORS[status] || "bg-gray-400"}`}></div>
                        <span className="text-sm">{getStatusLabel(status)}</span>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground text-sm">No inventory works found.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
