import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CRMDealItem {
  id: string;
  deal_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  artwork_id?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  artwork?: {
    id: string;
    title: string;
    image_url?: string;
  };
}

export function useCRMDealItems(dealId: string | undefined) {
  return useQuery({
    queryKey: ['crm-deal-items', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      
      const { data, error } = await supabase
        .from('crm_deal_items')
        .select(`
          *,
          artwork:artworks(id, title, image_url)
        `)
        .eq('deal_id', dealId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as CRMDealItem[];
    },
    enabled: !!dealId,
  });
}

export function useCreateCRMDealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Partial<CRMDealItem> & { deal_id: string }) => {
      const { data, error } = await supabase
        .from('crm_deal_items')
        .insert({
          deal_id: item.deal_id,
          description: item.description || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          discount_percent: item.discount_percent || 0,
          tax_percent: item.tax_percent || 0,
          artwork_id: item.artwork_id,
          display_order: item.display_order || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal-items', data.deal_id] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Line item added');
    },
    onError: (error) => {
      toast.error('Failed to add line item: ' + error.message);
    },
  });
}

export function useUpdateCRMDealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMDealItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_deal_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal-items', data.deal_id] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error) => {
      toast.error('Failed to update line item: ' + error.message);
    },
  });
}

export function useDeleteCRMDealItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId }: { id: string; dealId: string }) => {
      const { error } = await supabase
        .from('crm_deal_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, dealId };
    },
    onSuccess: ({ dealId }) => {
      queryClient.invalidateQueries({ queryKey: ['crm-deal-items', dealId] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
      toast.success('Line item removed');
    },
    onError: (error) => {
      toast.error('Failed to remove line item: ' + error.message);
    },
  });
}

// Calculate line item total
export function calculateLineTotal(item: CRMDealItem): number {
  const subtotal = item.quantity * item.unit_price;
  const afterDiscount = subtotal * (1 - (item.discount_percent || 0) / 100);
  const afterTax = afterDiscount * (1 + (item.tax_percent || 0) / 100);
  return Math.round(afterTax * 100) / 100;
}

// Calculate deal total from items
export function calculateDealTotal(items: CRMDealItem[]): number {
  return items.reduce((sum, item) => sum + calculateLineTotal(item), 0);
}

// Calculate weighted value based on probability
export function calculateWeightedValue(total: number, probability: number): number {
  return Math.round(total * (probability / 100) * 100) / 100;
}
