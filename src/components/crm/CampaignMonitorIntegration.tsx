import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, RotateCw, Users, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CampaignMonitorIntegration() {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Campaign Monitor Client ID
  const CAMPAIGN_MONITOR_CLIENT_ID = "129353";

  // Get sync status for all clients
  const { data: syncStats, isLoading } = useQuery({
    queryKey: ['campaign-monitor-sync-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('cm_sync_status')
        .not('email', 'is', null);

      if (error) throw error;

      const stats = {
        total: data.length,
        synced: data.filter(c => c.cm_sync_status === 'synced').length,
        pending: data.filter(c => c.cm_sync_status === 'pending').length,
        error: data.filter(c => c.cm_sync_status === 'error').length
      };

      return stats;
    }
  });

  // Sync single client mutation
  const syncClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/functions/v1/campaign-monitor-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_client',
          clientId,
          campaignMonitorClientId: CAMPAIGN_MONITOR_CLIENT_ID,
          listId: 'main-list' // This should be configurable
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Client synced to Campaign Monitor successfully');
      queryClient.invalidateQueries({ queryKey: ['campaign-monitor-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });

  // Bulk sync mutation
  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/functions/v1/campaign-monitor-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_all_clients',
          campaignMonitorClientId: CAMPAIGN_MONITOR_CLIENT_ID,
          listId: 'main-list' // This should be configurable
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Bulk sync completed: ${data.syncedCount} synced, ${data.errorCount} errors`);
      queryClient.invalidateQueries({ queryKey: ['campaign-monitor-sync-stats'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setIsSyncing(false);
    },
    onError: (error) => {
      toast.error(`Bulk sync failed: ${error.message}`);
      setIsSyncing(false);
    }
  });

  const handleBulkSync = () => {
    setIsSyncing(true);
    bulkSyncMutation.mutate();
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading sync status...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Campaign Monitor Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{syncStats?.total || 0}</div>
            <div className="text-sm text-muted-foreground">Total Clients</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{syncStats?.synced || 0}</div>
            <div className="text-sm text-muted-foreground">Synced</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{syncStats?.pending || 0}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{syncStats?.error || 0}</div>
            <div className="text-sm text-muted-foreground">Errors</div>
          </div>
        </div>

        {/* Sync Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleBulkSync}
            disabled={isSyncing || bulkSyncMutation.isPending}
            className="flex-1"
          >
            <RotateCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing All Clients...' : 'Sync All Clients'}
          </Button>
        </div>

        {/* Status Information */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Campaign Monitor integration syncs client data to your email lists using Client ID {CAMPAIGN_MONITOR_CLIENT_ID}. 
            Make sure to configure your Campaign Monitor API key in the Supabase secrets.
          </AlertDescription>
        </Alert>

        {/* Sync Status Legend */}
        <div className="flex flex-wrap gap-2">
          <Badge className={getSyncStatusColor('synced')}>
            {getSyncStatusIcon('synced')}
            <span className="ml-1">Synced</span>
          </Badge>
          <Badge className={getSyncStatusColor('pending')}>
            {getSyncStatusIcon('pending')}
            <span className="ml-1">Pending</span>
          </Badge>
          <Badge className={getSyncStatusColor('error')}>
            {getSyncStatusIcon('error')}
            <span className="ml-1">Error</span>
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
