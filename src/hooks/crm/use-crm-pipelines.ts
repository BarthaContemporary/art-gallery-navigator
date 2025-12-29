import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMPipeline, CRMPipelineStage, CRMDeal } from "@/types/crm";
import { toast } from "sonner";

export function useCRMPipelines() {
  return useQuery({
    queryKey: ['crm-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select(`
          *,
          stages:crm_pipeline_stages(*)
        `)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Sort stages by display_order
      return (data || []).map(pipeline => ({
        ...pipeline,
        stages: pipeline.stages?.sort((a: CRMPipelineStage, b: CRMPipelineStage) => 
          a.display_order - b.display_order
        ),
      })) as CRMPipeline[];
    },
  });
}

export function useCRMPipeline(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-pipeline', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select(`
          *,
          stages:crm_pipeline_stages(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        stages: data.stages?.sort((a: CRMPipelineStage, b: CRMPipelineStage) => 
          a.display_order - b.display_order
        ),
      } as CRMPipeline;
    },
    enabled: !!id,
  });
}

export function useCRMDeals(pipelineId?: string) {
  return useQuery({
    queryKey: ['crm-deals', pipelineId],
    queryFn: async () => {
      let query = supabase
        .from('crm_deals')
        .select(`
          *,
          stage:crm_pipeline_stages(*),
          contact:crm_contacts(id, full_name, email),
          organization:crm_organizations(id, name),
          contacts:crm_deal_contacts(
            id,
            contact_id,
            role,
            is_primary,
            display_order,
            created_at,
            contact:crm_contacts(id, full_name, email, phone)
          )
        `)
        .order('display_order', { ascending: true });

      if (pipelineId) {
        query = query.eq('pipeline_id', pipelineId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Sort contacts by display_order
      return (data || []).map(deal => ({
        ...deal,
        contacts: deal.contacts?.sort((a: any, b: any) => a.display_order - b.display_order)
      })) as CRMDeal[];
    },
  });
}

export function useCreateCRMDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deal: Partial<CRMDeal> & { contact_ids?: string[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const insertData = {
        name: deal.name || '',
        pipeline_id: deal.pipeline_id || '',
        stage_id: deal.stage_id,
        contact_id: deal.contact_id, // Keep for backward compat
        organization_id: deal.organization_id,
        value: deal.value,
        currency: deal.currency,
        probability: deal.probability,
        expected_close_date: deal.expected_close_date,
        status: deal.status,
        notes: deal.notes,
        display_order: deal.display_order,
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from('crm_deals')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      
      // Insert deal contacts if provided
      if (deal.contact_ids && deal.contact_ids.length > 0) {
        const dealContacts = deal.contact_ids.map((contactId, index) => ({
          deal_id: data.id,
          contact_id: contactId,
          is_primary: index === 0,
          display_order: index,
        }));
        
        await supabase.from('crm_deal_contacts').insert(dealContacts);
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Deal created');
    },
    onError: (error) => {
      toast.error('Failed to create deal: ' + error.message);
    },
  });
}

export function useUpdateCRMDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contact_ids, contacts, ...updates }: Partial<CRMDeal> & { id: string; contact_ids?: string[] }) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      // Update deal contacts if provided
      if (contact_ids !== undefined) {
        // Delete existing contacts
        await supabase.from('crm_deal_contacts').delete().eq('deal_id', id);
        
        // Insert new contacts
        if (contact_ids.length > 0) {
          const dealContacts = contact_ids.map((contactId, index) => ({
            deal_id: id,
            contact_id: contactId,
            is_primary: index === 0,
            display_order: index,
          }));
          
          await supabase.from('crm_deal_contacts').insert(dealContacts);
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Deal updated');
    },
    onError: (error) => {
      toast.error('Failed to update deal: ' + error.message);
    },
  });
}

export function useDeleteCRMDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_deals')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Deal deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete deal: ' + error.message);
    },
  });
}

export function useMoveDealToStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, stageId, displayOrder }: { dealId: string; stageId: string; displayOrder: number }) => {
      const { data, error } = await supabase
        .from('crm_deals')
        .update({ stage_id: stageId, display_order: displayOrder })
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error) => {
      toast.error('Failed to move deal: ' + error.message);
    },
  });
}

export function useReorderDeals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deals: { id: string; display_order: number; stage_id?: string }[]) => {
      const updates = deals.map(({ id, display_order, stage_id }) =>
        supabase
          .from('crm_deals')
          .update({ display_order, ...(stage_id && { stage_id }) })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error) => {
      toast.error('Failed to reorder deals: ' + error.message);
    },
  });
}
