
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSyncClientMutation() {
  const queryClient = useQueryClient();
  const CAMPAIGN_MONITOR_CLIENT_ID = "129353";

  return useMutation({
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
          listId: 'main-list'
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
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });
}
