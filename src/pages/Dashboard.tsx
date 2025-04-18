
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Palette, Users, Calendar, Landmark, User, DollarSign } from "lucide-react";

const Dashboard = () => {
  // Mock data for initial dashboard
  const stats = [
    { title: "Total Artworks", value: 186, icon: <Palette className="h-5 w-5" />, change: "+12% from last month" },
    { title: "Artists", value: 42, icon: <Users className="h-5 w-5" />, change: "+3 new artists" },
    { title: "Exhibitions", value: 8, icon: <Calendar className="h-5 w-5" />, change: "2 upcoming" },
    { title: "Locations", value: 5, icon: <Landmark className="h-5 w-5" />, change: "3 active" },
    { title: "Clients", value: 128, icon: <User className="h-5 w-5" />, change: "+5% from last month" },
    { title: "Sales", value: "$450K", icon: <DollarSign className="h-5 w-5" />, change: "+8% from last month" }
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Gallery inventory overview and key metrics
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
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
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates to your gallery inventory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                <div>
                  <p className="text-sm font-medium">New artwork added: "Abstract Composition #42"</p>
                  <p className="text-xs text-muted-foreground">Today at 14:32</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <div>
                  <p className="text-sm font-medium">Sale completed: "Summer Landscape"</p>
                  <p className="text-xs text-muted-foreground">Yesterday at 11:15</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                <div>
                  <p className="text-sm font-medium">New exhibition created: "Modern Perspectives"</p>
                  <p className="text-xs text-muted-foreground">April 16, 2025</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                <div>
                  <p className="text-sm font-medium">Client inquiry: Regarding "Blue Reflections"</p>
                  <p className="text-xs text-muted-foreground">April 15, 2025</p>
                </div>
              </div>
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Available</span>
                </div>
                <span className="font-medium">118</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                  <span className="text-sm">On Hold</span>
                </div>
                <span className="font-medium">24</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Consigned</span>
                </div>
                <span className="font-medium">17</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <span className="text-sm">Sold</span>
                </div>
                <span className="font-medium">27</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
