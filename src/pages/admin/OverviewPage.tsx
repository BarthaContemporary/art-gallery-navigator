import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserPlus, 
  Plug, 
  Settings, 
  Activity,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Stats {
  totalUsers: number;
  totalContacts: number;
  totalProjects: number;
  recentActivity: Array<{
    id: string;
    event_type: string;
    created_at: string;
    details: any;
  }>;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalContacts: 0,
    totalProjects: 0,
    recentActivity: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, contactsRes, projectsRes, activityRes] = await Promise.allSettled([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('crm_contacts').select('id', { count: 'exact', head: true }),
          supabase.from('projects').select('id', { count: 'exact', head: true }),
          supabase.from('security_events').select('*').order('created_at', { ascending: false }).limit(10)
        ]);

        setStats({
          totalUsers: usersRes.status === 'fulfilled' ? (usersRes.value.count || 0) : 0,
          totalContacts: contactsRes.status === 'fulfilled' ? (contactsRes.value.count || 0) : 0,
          totalProjects: projectsRes.status === 'fulfilled' ? (projectsRes.value.count || 0) : 0,
          recentActivity: activityRes.status === 'fulfilled' ? (activityRes.value.data || []) : []
        });
      } catch (error) {
        console.error('Error fetching admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const quickActions = [
    { label: "Invite User", href: "/admin/users", icon: UserPlus },
    { label: "Manage Integrations", href: "/admin/integrations", icon: Plug },
    { label: "System Settings", href: "/admin/settings", icon: Settings },
  ];

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('error') || eventType.includes('critical')) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
    if (eventType.includes('success') || eventType.includes('created')) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .replace(/_/g, ' ')
      .replace(/high|info|critical/gi, '')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin Overview</h1>
        <p className="text-muted-foreground text-sm">
          System snapshot and quick actions
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              Registered accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CRM Contacts</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.totalContacts}
            </div>
            <p className="text-xs text-muted-foreground">
              In database
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "..." : stats.totalProjects}
            </div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Button key={action.href} variant="outline" asChild>
                <Link to={action.href}>
                  <action.icon className="h-4 w-4 mr-2" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system events</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/logs">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : stats.recentActivity.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No recent activity</div>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  {getEventIcon(event.event_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {formatEventType(event.event_type)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.details?.user_id ? `User: ${event.details.user_id.slice(0, 8)}...` : 'System'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(event.created_at), 'MMM d, HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
