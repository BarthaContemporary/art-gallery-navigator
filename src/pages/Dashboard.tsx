import { MaterialIcon } from "@/components/ui/material-icon";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { ArtworkValueByLocation } from "@/components/dashboard/ArtworkValueByLocation";
const Dashboard = () => {
  const {
    data: stats,
    isLoading,
    error
  } = useDashboardStats();
  const {
    isAdmin
  } = useAuth();

  // Color palette for charts
  const STATUS_COLORS = {
    "available": "hsl(var(--success))",
    "on hold": "hsl(var(--warning))",
    "in transit": "hsl(var(--info))",
    "sold": "hsl(var(--primary))",
    "consigned": "hsl(var(--secondary))",
    "not for sale": "hsl(var(--muted))",
    "returned": "hsl(var(--destructive))",
    "unknown": "hsl(var(--muted-foreground))"
  };

  // Transform inventory data for charts
  const inventoryData = stats ? Object.entries(stats.inventory_statuses || {}).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    fill: STATUS_COLORS[status] || "hsl(var(--muted))"
  })) : [];

  // Main stats data
  const mainStats = [{
    title: "Artworks",
    value: stats?.artworks_count ?? 0,
    icon: <MaterialIcon icon="palette" size={16} />,
    trend: "+12%",
    isPositive: true
  }, {
    title: "Artists",
    value: stats?.artists_count ?? 0,
    icon: <MaterialIcon icon="people" size={16} />,
    trend: "+5%",
    isPositive: true
  }, {
    title: "Locations",
    value: stats?.locations_count ?? 0,
    icon: <MaterialIcon icon="location_on" size={16} />,
    trend: "0%",
    isPositive: null
  }, {
    title: "Collections",
    value: stats?.collections_count ?? 0,
    icon: <MaterialIcon icon="folder" size={16} />,
    trend: "+8%",
    isPositive: true
  }];
  if (error) {
    return <div className="p-3 sm:p-4 max-w-6xl mx-auto">
        <div className="text-destructive p-4 border border-destructive/20 rounded-md">
          Error loading dashboard data. Please refresh the page or try again later.
        </div>
      </div>;
  }
  return <div className="p-3 sm:p-4 max-w-6xl mx-auto space-y-4">
      

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {mainStats.map((stat, index) => <Card key={index} className="p-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{stat.title}</p>
                {isLoading ? <Skeleton className="h-6 w-8" /> : <p className="text-lg font-bold">{stat.value}</p>}
                <div className="flex items-center gap-1 text-xs">
                  {stat.isPositive === true && <MaterialIcon icon="trending_up" size={12} className="text-success" />}
                  {stat.isPositive === false && <MaterialIcon icon="trending_down" size={12} className="text-destructive" />}
                  <span className={stat.isPositive === true ? "text-success" : stat.isPositive === false ? "text-destructive" : "text-muted-foreground"}>
                    {stat.trend}
                  </span>
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                {stat.icon}
              </div>
            </div>
          </Card>)}
      </div>

      {/* CRM Stats for Admin */}
      {isAdmin && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[{
        title: "Total Clients",
        value: stats?.total_clients_count ?? 0,
        icon: <MaterialIcon icon="people" size={16} />,
        color: "text-blue-600"
      }, {
        title: "Active",
        value: stats?.active_clients_count ?? 0,
        icon: <MaterialIcon icon="radio_button_checked" size={16} />,
        color: "text-green-600"
      }, {
        title: "Prospects",
        value: stats?.prospects_count ?? 0,
        icon: <MaterialIcon icon="trending_up" size={16} />,
        color: "text-yellow-600"
      }, {
        title: "Customers",
        value: stats?.customers_count ?? 0,
        icon: <MaterialIcon icon="people" size={16} />,
        color: "text-purple-600"
      }].map((stat, index) => <Card key={index} className="p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                  {isLoading ? <Skeleton className="h-5 w-6" /> : <p className="text-lg font-bold">{stat.value}</p>}
                </div>
                <div className={`${stat.color}`}>
                  {stat.icon}
                </div>
              </div>
            </Card>)}
        </div>}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inventory Status with Chart */}
        <Card className="p-4">
          <CardHeader className="pb-3 py-[10px]">
            <CardTitle className="text-base flex items-center gap-2">
              <MaterialIcon icon="bar_chart" size={16} />
              Inventory Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-3">
                <Skeleton className="h-32 w-full" />
                <div className="space-y-2">
                  {[1, 2, 3].map(n => <div key={n} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-8" />
                    </div>)}
                </div>
              </div> : inventoryData.length > 0 ? <div className="space-y-4">
                <div className="h-32">
                  <ChartContainer config={{
                value: {
                  label: "Count"
                }
              }} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={inventoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
                          {inventoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                <div className="space-y-2">
                  {inventoryData.map((item, index) => <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{
                    backgroundColor: item.fill
                  }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>)}
                </div>
              </div> : <p className="text-muted-foreground text-sm">No inventory data available</p>}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="p-4">
          <CardHeader className="pb-3 py-[10px]">
            <CardTitle className="text-base flex items-center gap-2">
              <MaterialIcon icon="schedule" size={16} />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="space-y-3">
                {[1, 2, 3, 4].map(n => <div key={n} className="flex items-center gap-3">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>)}
              </div> : stats?.recent_activities && stats.recent_activities.length > 0 ? <div className="space-y-3">
                {stats.recent_activities.slice(0, 6).map((activity, index) => <div key={index} className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full bg-${activity.color || 'primary'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.timestamp), "MMM d, HH:mm")}
                      </p>
                    </div>
                  </div>)}
              </div> : <p className="text-muted-foreground text-sm">No recent activities</p>}
          </CardContent>
        </Card>
      </div>

      {/* Artwork Value by Location */}
      <ArtworkValueByLocation />

      {/* Admin Notifications */}
      {isAdmin && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/documents" className="no-underline">
            <Card className={`p-4 hover:bg-accent/50 transition-colors ${stats?.pending_deletions_count ? 'border-warning' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Pending Deletions</p>
                  {isLoading ? <Skeleton className="h-6 w-8 mt-1" /> : <p className="text-lg font-bold">{stats?.pending_deletions_count ?? 0}</p>}
                  <p className="text-xs text-muted-foreground">Items awaiting review</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center text-warning">
                  <MaterialIcon icon="error" size={16} />
                </div>
              </div>
            </Card>
          </Link>

          <Link to="/file-transfer" className="no-underline">
            <Card className={`p-4 hover:bg-accent/50 transition-colors ${stats?.new_uploads_count ? 'border-info' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">New Uploads</p>
                  {isLoading ? <Skeleton className="h-6 w-8 mt-1" /> : <p className="text-lg font-bold">{stats?.new_uploads_count ?? 0}</p>}
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center text-info">
                  <MaterialIcon icon="file_upload" size={16} />
                </div>
              </div>
            </Card>
          </Link>
        </div>}
    </div>;
};
export default Dashboard;