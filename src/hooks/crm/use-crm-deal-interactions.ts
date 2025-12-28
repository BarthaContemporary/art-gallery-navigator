import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMDealInteraction, CRMDealInteractionType, CRMInteractionDirection, CRMContact } from "@/types/crm";
import { toast } from "sonner";

// Get all interactions for a deal
export function useDealInteractions(dealId?: string) {
  return useQuery({
    queryKey: ['crm-deal-interactions', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await supabase
        .from('crm_deal_interactions')
        .select(`
          *,
          contact:crm_contacts(id, full_name, email)
        `)
        .eq('deal_id', dealId)
        .order('interaction_date', { ascending: false });
      
      if (error) throw error;
      return data as (CRMDealInteraction & { contact?: CRMContact })[];
    },
    enabled: !!dealId,
  });
}

// Create a deal interaction
export function useCreateDealInteraction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      deal_id: string;
      contact_id?: string;
      type: CRMDealInteractionType;
      direction?: CRMInteractionDirection;
      subject?: string;
      summary?: string;
      interaction_date?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data: result, error } = await supabase
        .from('crm_deal_interactions')
        .insert({
          deal_id: data.deal_id,
          contact_id: data.contact_id || null,
          type: data.type,
          direction: data.direction || null,
          subject: data.subject || null,
          summary: data.summary || null,
          interaction_date: data.interaction_date || new Date().toISOString(),
          created_by: userData?.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal-interactions', variables.deal_id] });
      toast.success("Interaction logged");
    },
    onError: () => {
      toast.error("Failed to log interaction");
    },
  });
}

// Update a deal interaction
export function useUpdateDealInteraction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      id: string;
      deal_id: string;
      type?: CRMDealInteractionType;
      direction?: CRMInteractionDirection;
      subject?: string;
      summary?: string;
      interaction_date?: string;
    }) => {
      const { error } = await supabase
        .from('crm_deal_interactions')
        .update({
          type: data.type,
          direction: data.direction,
          subject: data.subject,
          summary: data.summary,
          interaction_date: data.interaction_date,
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal-interactions', variables.deal_id] });
    },
    onError: () => {
      toast.error("Failed to update interaction");
    },
  });
}

// Delete a deal interaction
export function useDeleteDealInteraction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { id: string; deal_id: string }) => {
      const { error } = await supabase
        .from('crm_deal_interactions')
        .delete()
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal-interactions', variables.deal_id] });
      toast.success("Interaction deleted");
    },
    onError: () => {
      toast.error("Failed to delete interaction");
    },
  });
}
