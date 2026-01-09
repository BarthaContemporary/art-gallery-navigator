import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContactDeal {
  id: string;
  deal_id: string;
  contact_id: string;
  role: string | null;
  is_primary: boolean;
  deal: {
    id: string;
    name: string;
    value: number | null;
    currency: string | null;
    status: string | null;
    probability: number | null;
    expected_close_date: string | null;
    stage_id: string | null;
    pipeline_id: string | null;
    organization: {
      id: string;
      name: string;
    } | null;
    stage: {
      id: string;
      name: string;
      color: string | null;
    } | null;
  };
}

export function useContactDeals(contactId?: string) {
  return useQuery({
    queryKey: ['crm-contact-deals', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('crm_deal_contacts')
        .select(`
          id,
          deal_id,
          contact_id,
          role,
          is_primary,
          deal:crm_deals(
            id,
            name,
            value,
            currency,
            status,
            probability,
            expected_close_date,
            stage_id,
            pipeline_id,
            organization:crm_organizations(id, name),
            stage:crm_pipeline_stages(id, name, color)
          )
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).filter(d => d.deal) as ContactDeal[];
    },
    enabled: !!contactId,
  });
}
