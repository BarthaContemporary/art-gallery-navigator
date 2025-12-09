import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ScrollText, 
  Search, 
  RefreshCw, 
  Clock,
  User,
  Activity,
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SecurityEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  ip_address: unknown;
  user_agent: string | null;
  details: any;
  created_at: string;
}

export default function LogsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchTerm) {
        query = query.or(`event_type.ilike.%${searchTerm}%,details.cs.{"user_id":"${searchTerm}"}`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching security events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  const getSeverityFromEvent = (eventType: string): 'info' | 'warning' | 'error' => {
    if (eventType.includes('critical') || eventType.includes('error') || eventType.includes('failed')) {
      return 'error';
    }
    if (eventType.includes('high') || eventType.includes('warning')) {
      return 'warning';
    }
    return 'info';
  };

  const getSeverityBadge = (severity: 'info' | 'warning' | 'error') => {
    switch (severity) {
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700"><Info className="h-3 w-3 mr-1" />Warning</Badge>;
      default:
        return <Badge variant="outline"><CheckCircle className="h-3 w-3 mr-1" />Info</Badge>;
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .replace(/_/g, ' ')
      .replace(/high|info|critical|low|medium/gi, '')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const filteredEvents = events.filter(event => {
    if (filterType === 'all') return true;
    const severity = getSeverityFromEvent(event.event_type);
    return severity === filterType;
  });

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Logs & Audit</h1>
        <p className="text-muted-foreground text-sm">
          View system activity and security events
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" />
                Security Events
              </CardTitle>
              <CardDescription>
                Recent system and security activity
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by event type or user ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-10 px-3 border border-input bg-background text-sm"
            >
              <option value="all">All Severities</option>
              <option value="error">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Events Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading events...</div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No events found</div>
          ) : (
            <div className="border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead className="hidden md:table-cell">User</TableHead>
                    <TableHead className="hidden lg:table-cell">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => {
                    const severity = getSeverityFromEvent(event.event_type);
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(event.created_at), 'MMM d, HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{formatEventType(event.event_type)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getSeverityBadge(severity)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {event.user_id ? (
                            <div className="flex items-center gap-1 text-xs">
                              <User className="h-3 w-3" />
                              <span className="font-mono">{event.user_id.slice(0, 8)}...</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">System</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell max-w-[200px]">
                          <span className="text-xs text-muted-foreground truncate block">
                            {event.details ? JSON.stringify(event.details).slice(0, 50) + '...' : '-'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            Showing {filteredEvents.length} of {events.length} events
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
