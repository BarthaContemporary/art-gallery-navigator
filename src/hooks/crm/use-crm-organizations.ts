import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMOrganization, CRMOrganizationType } from "@/types/crm";
import { toast } from "sonner";

interface UseOrganizationsOptions {
  searchTerm?: string;
  type?: CRMOrganizationType | 'all';
}

export function useCRMOrganizations(options: UseOrganizationsOptions = {}) {
  const { searchTerm, type } = options;

  return useQuery({
    queryKey: ['crm-organizations', searchTerm, type],
    queryFn: async () => {
      let query = supabase
        .from('crm_organizations')
        .select('*')
        .order('name', { ascending: true });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CRMOrganization[];
    },
  });
}

export function useCRMOrganization(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-organization', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('crm_organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CRMOrganization;
    },
    enabled: !!id,
  });
}

export function useCreateCRMOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (org: Partial<CRMOrganization>) => {
      const insertData = {
        name: org.name || '',
        type: org.type,
        website: org.website,
        phone: org.phone,
        email: org.email,
        address_line1: org.address_line1,
        address_line2: org.address_line2,
        city: org.city,
        state: org.state,
        postal_code: org.postal_code,
        country: org.country,
        notes: org.notes,
        tags: org.tags,
        vat_number: org.vat_number,
        eori_number: org.eori_number,
        company_number: org.company_number,
      };
      
      const { data, error } = await supabase
        .from('crm_organizations')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-organizations'] });
      toast.success('Organization created');
    },
    onError: (error) => {
      toast.error('Failed to create organization: ' + error.message);
    },
  });
}

export function useUpdateCRMOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMOrganization> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['crm-organization', data.id] });
      toast.success('Organization updated');
    },
    onError: (error) => {
      toast.error('Failed to update organization: ' + error.message);
    },
  });
}

export function useDeleteCRMOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-organizations'] });
      toast.success('Organization deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete organization: ' + error.message);
    },
  });
}
