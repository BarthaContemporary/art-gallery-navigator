import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CMList {
  ListID: string;
  Name: string;
}

interface CMCampaign {
  CampaignID: string;
  Name: string;
  Subject: string;
  FromName: string;
  FromEmail: string;
  SentDate?: string;
  TotalRecipients?: number;
  WebVersionURL?: string;
}

interface CMCampaignSummary {
  Recipients: number;
  TotalOpened: number;
  Clicks: number;
  Unsubscribed: number;
  Bounced: number;
  UniqueOpened: number;
  SpamComplaints: number;
  WebVersionURL: string;
}

interface CMCampaigns {
  sent: CMCampaign[];
  drafts: CMCampaign[];
  scheduled: CMCampaign[];
}

export function useCampaignMonitorLists() {
  return useQuery({
    queryKey: ['campaign-monitor', 'lists'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-monitor-sync', {
        body: { action: 'get_lists' }
      });

      if (error) throw error;
      return data as CMList[];
    },
  });
}

export function useCampaignMonitorCampaigns() {
  return useQuery({
    queryKey: ['campaign-monitor', 'campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('campaign-monitor-sync', {
        body: { action: 'get_campaigns' }
      });

      if (error) throw error;
      return data as CMCampaigns;
    },
  });
}

export function useCampaignSummary(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-monitor', 'summary', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      
      const { data, error } = await supabase.functions.invoke('campaign-monitor-sync', {
        body: { action: 'get_campaign_summary', contactId: campaignId }
      });

      if (error) throw error;
      return data as CMCampaignSummary;
    },
    enabled: !!campaignId,
  });
}

export function useSyncContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, listId }: { contactId: string; listId: string }) => {
      const { data, error } = await supabase.functions.invoke('campaign-monitor-sync', {
        body: { action: 'sync_contact', contactId, listId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Contact synced to Campaign Monitor');
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
    onError: (error) => {
      toast.error('Failed to sync contact');
      console.error('Sync error:', error);
    },
  });
}

export function useSyncAllContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      const { data, error } = await supabase.functions.invoke('campaign-monitor-sync', {
        body: { action: 'sync_all_contacts', listId }
      });

      if (error) throw error;
      return data as { syncedCount: number; errorCount: number; totalContacts: number };
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.syncedCount} contacts (${data.errorCount} errors)`);
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
    },
    onError: (error) => {
      toast.error('Failed to sync contacts');
      console.error('Bulk sync error:', error);
    },
  });
}
