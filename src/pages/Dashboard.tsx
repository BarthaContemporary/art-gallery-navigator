import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Users, Landmark } from "lucide-react";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { format } from "date-fns";
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
function getStatusLabel(status: string) {
  return status.split(' ').map(str => str.charAt(0).toUpperCase() + str.slice(1)).join(' ');
}
const Dashboard = () => {
  const {
    data: stats,
    isLoading
  } = useDashboardStats();
  const statsCards = [{
    title: "Total Artworks",
    value: stats?.artworks_count || 0,
    icon: <Palette className="h-5 w-5" />,
    change: "Updated in real-time"
  }, {
    title: "Artists",
    value: stats?.artists_count || 0,
    icon: <Users className="h-5 w-5" />,
    change: "Active artists"
  }, {
    title: "Locations",
    value: stats?.locations_count || 0,
    icon: <Landmark className="h-5 w-5" />,
    change: "Gallery spaces"
  }];
  const orderedStatuses = stats ? Object.entries(stats.inventory_statuses).sort((a, b) => a[0].localeCompare(b[0])) : [];
  return <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl tracking-wide text-slate-500 font-thin">DASHBOARD</h1>
          <p className="text-muted-foreground">
        </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((stat, index) => <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>)}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates to your gallery inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats?.recent_activities.map((activity, index) => <div key={index} className="flex items-center gap-4">
                  <div className={`h-2 w-2 rounded-full bg-${activity.color}-500`}></div>
                  <div>
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(activity.timestamp), "MMMM d, yyyy 'at' HH:mm")}
                    </p>
                  </div>
                </div>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inventory Status</CardTitle>
            <CardDescription>Current status of artworks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orderedStatuses.map(([status, count]) => <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${STATUS_COLORS[status] || "bg-gray-400"}`}></div>
                    <span className="text-sm">{getStatusLabel(status)}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>)}
              {orderedStatuses.length === 0 && <div className="text-muted-foreground text-sm">No inventory works found.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default Dashboard;