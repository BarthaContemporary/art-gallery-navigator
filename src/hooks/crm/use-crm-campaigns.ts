import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMCampaign, CRMCampaignStatus } from "@/types/crm";
import { toast } from "sonner";

interface UseCampaignsOptions {
  status?: CRMCampaignStatus | 'all';
}

export function useCRMCampaigns(options: UseCampaignsOptions = {}) {
  const { status } = options;

  return useQuery({
    queryKey: ['crm-campaigns', status],
    queryFn: async () => {
      let query = supabase
        .from('crm_campaigns')
        .select(`
          *,
          list:crm_lists(id, name, type)
        `)
        .order('display_order', { ascending: true });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CRMCampaign[];
    },
  });
}

export function useCRMCampaign(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-campaign', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select(`
          *,
          list:crm_lists(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CRMCampaign;
    },
    enabled: !!id,
  });
}

export function useCreateCRMCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Partial<CRMCampaign>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const insertData = {
        name: campaign.name || '',
        description: campaign.description,
        list_id: campaign.list_id,
        subject: campaign.subject,
        preview_text: campaign.preview_text,
        from_name: campaign.from_name,
        from_email: campaign.from_email,
        status: campaign.status,
        display_order: campaign.display_order,
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from('crm_campaigns')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
      toast.success('Campaign created');
    },
    onError: (error) => {
      toast.error('Failed to create campaign: ' + error.message);
    },
  });
}

export function useUpdateCRMCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMCampaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['crm-campaign', data.id] });
      toast.success('Campaign updated');
    },
    onError: (error) => {
      toast.error('Failed to update campaign: ' + error.message);
    },
  });
}

export function useDeleteCRMCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
      toast.success('Campaign deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete campaign: ' + error.message);
    },
  });
}

export function useSnapshotCampaignAudience() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, listId }: { campaignId: string; listId: string }) => {
      // Get all contacts in the list
      const { data: members, error: membersError } = await supabase
        .from('crm_list_members')
        .select('contact_id')
        .eq('list_id', listId);

      if (membersError) throw membersError;

      const contactIds = members?.map(m => m.contact_id) || [];

      // Update the campaign with the snapshot
      const { data, error } = await supabase
        .from('crm_campaigns')
        .update({
          audience_snapshot: { contact_ids: contactIds },
          total_recipients: contactIds.length,
        })
        .eq('id', campaignId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['crm-campaign', data.id] });
      toast.success('Audience snapshot created');
    },
    onError: (error) => {
      toast.error('Failed to snapshot audience: ' + error.message);
    },
  });
}
