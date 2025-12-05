import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMInteraction, CRMInteractionType } from "@/types/crm";
import { toast } from "sonner";

interface UseInteractionsOptions {
  contactId?: string;
  organizationId?: string;
  type?: CRMInteractionType | 'all';
  limit?: number;
}

export function useCRMInteractions(options: UseInteractionsOptions = {}) {
  const { contactId, organizationId, type, limit = 50 } = options;

  return useQuery({
    queryKey: ['crm-interactions', contactId, organizationId, type, limit],
    queryFn: async () => {
      let query = supabase
        .from('crm_interactions')
        .select(`
          *,
          contact:crm_contacts(id, full_name, email),
          organization:crm_organizations(id, name)
        `)
        .order('interaction_date', { ascending: false })
        .limit(limit);

      if (contactId) {
        query = query.eq('contact_id', contactId);
      }

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CRMInteraction[];
    },
  });
}

export function useCreateCRMInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interaction: Partial<CRMInteraction>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('crm_interactions')
        .insert({
          ...interaction,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Update last_interaction_date on the contact
      if (interaction.contact_id) {
        await supabase
          .from('crm_contacts')
          .update({ last_interaction_date: new Date().toISOString() })
          .eq('id', interaction.contact_id);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-interactions'] });
      if (data.contact_id) {
        queryClient.invalidateQueries({ queryKey: ['crm-contact', data.contact_id] });
      }
      toast.success('Interaction logged');
    },
    onError: (error) => {
      toast.error('Failed to log interaction: ' + error.message);
    },
  });
}

export function useUpdateCRMInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMInteraction> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_interactions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-interactions'] });
      toast.success('Interaction updated');
    },
    onError: (error) => {
      toast.error('Failed to update interaction: ' + error.message);
    },
  });
}

export function useDeleteCRMInteraction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_interactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-interactions'] });
      toast.success('Interaction deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete interaction: ' + error.message);
    },
  });
}
