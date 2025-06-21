
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Shield, Activity, Users, Eye } from "lucide-react";
import { enhancedSecurityMonitor } from "@/utils/enhanced-security-monitoring";
import { useAuth } from "@/hooks/use-auth";

interface SecurityEvent {
  id: string;
  type: string;
  severity: string;
  details: any;
  timestamp: number;
  userId?: string;
}

interface SuspiciousActivity {
  type: string;
  severity: string;
  description: string;
  userId?: string;
  data: any;
}

export function SecurityDashboard() {
  const { isAdmin } = useAuth();
  const [securityReport, setSecurityReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const loadSecurityReport = () => {
      try {
        const report = enhancedSecurityMonitor.generateSecurityReport();
        setSecurityReport(report);
      } catch (error) {
        console.error('Failed to load security report:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSecurityReport();
    const interval = setInterval(loadSecurityReport, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to view this security dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading security report...</div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">Monitor and analyze security events</p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Security Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityReport?.summary?.totalEvents || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suspicious Activities</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {securityReport?.summary?.suspiciousActivitiesCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {securityReport?.summary?.blockedIPsCount || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {securityReport?.summary?.severityBreakdown?.critical || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
          <TabsTrigger value="suspicious">Suspicious Activities</TabsTrigger>
          <TabsTrigger value="blocked">Blocked IPs</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Latest 50 security events from the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {securityReport?.recentEvents?.map((event: SecurityEvent, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      <div>
                        <div className="font-medium">{event.type}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(event.timestamp)}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {event.details?.action || 'Unknown action'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suspicious" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Suspicious Activities</CardTitle>
              <CardDescription>Potentially malicious or unusual behavior patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {securityReport?.suspiciousActivities?.map((activity: SuspiciousActivity, index: number) => (
                  <Alert key={index} className="border-orange-200">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div>
                          <strong>{activity.type}</strong>: {activity.description}
                          {activity.userId && (
                            <div className="text-sm text-muted-foreground mt-1">
                              User ID: {activity.userId}
                            </div>
                          )}
                        </div>
                        <Badge className={getSeverityColor(activity.severity)}>
                          {activity.severity}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
                {(!securityReport?.suspiciousActivities || securityReport.suspiciousActivities.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No suspicious activities detected
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Blocked IP Addresses</CardTitle>
              <CardDescription>IP addresses currently blocked due to suspicious activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {securityReport?.blockedIPs?.map((ip: string, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="font-mono">{ip}</div>
                    <Badge variant="destructive">Blocked</Badge>
                  </div>
                ))}
                {(!securityReport?.blockedIPs || securityReport.blockedIPs.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No IP addresses currently blocked
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Event Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(securityReport?.summary?.eventTypes || {}).map(([type, count]) => (
                    <div key={type} className="flex justify-between">
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Severity Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(securityReport?.summary?.severityBreakdown || {}).map(([severity, count]) => (
                    <div key={severity} className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getSeverityColor(severity)}`} />
                        <span className="capitalize">{severity}</span>
                      </div>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
