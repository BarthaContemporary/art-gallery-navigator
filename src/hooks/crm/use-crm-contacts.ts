import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMContact, CRMContactType } from "@/types/crm";
import { toast } from "sonner";

interface UseContactsOptions {
  searchTerm?: string;
  contactType?: CRMContactType | 'all';
  tags?: string[];
  listId?: string;
  page?: number;
  pageSize?: number;
}

export function useCRMContacts(options: UseContactsOptions = {}) {
  const { searchTerm, contactType, tags, listId, page = 1, pageSize = 100 } = options;

  return useQuery({
    queryKey: ['crm-contacts', searchTerm, contactType, tags, listId, page, pageSize],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('crm_contacts')
        .select(`
          *,
          organization:crm_organizations(*)
        `, { count: 'exact' })
        .order('full_name', { ascending: true })
        .range(from, to);

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      if (contactType && contactType !== 'all') {
        query = query.eq('contact_type', contactType);
      }

      if (tags && tags.length > 0) {
        query = query.overlaps('tags', tags);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      // If filtering by list, get members and filter
      if (listId) {
        const { data: members, error: membersError } = await supabase
          .from('crm_list_members')
          .select('contact_id')
          .eq('list_id', listId);

        if (membersError) throw membersError;
        
        const memberIds = new Set(members?.map(m => m.contact_id) || []);
        const filtered = (data || []).filter(c => memberIds.has(c.id)) as CRMContact[];
        return { contacts: filtered, totalCount: filtered.length };
      }

      return { contacts: data as CRMContact[], totalCount: count || 0 };
    },
  });
}

export function useCRMContact(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-contact', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('crm_contacts')
        .select(`
          *,
          organization:crm_organizations(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CRMContact;
    },
    enabled: !!id,
  });
}

export function useCreateCRMContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contact: Partial<CRMContact>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const insertData = {
        full_name: contact.full_name || '',
        email: contact.email || null,
        phone: contact.phone || null,
        secondary_phone: contact.secondary_phone || null,
        address_line1: contact.address_line1 || null,
        address_line2: contact.address_line2 || null,
        city: contact.city || null,
        state: contact.state || null,
        postal_code: contact.postal_code || null,
        country: contact.country || null,
        instagram_handle: contact.instagram_handle || null,
        linkedin_handle: contact.linkedin_handle || null,
        whatsapp_number: contact.whatsapp_number || null,
        line_id: contact.line_id || null,
        wechat_id: contact.wechat_id || null,
        job_title: contact.job_title || null,
        organization_id: contact.organization_id || null,
        contact_type: contact.contact_type,
        status: contact.status || null,
        source: contact.source || null,
        tags: contact.tags || null,
        notes: contact.notes || null,
        birthday: contact.birthday || null,
        marketing_consent: contact.marketing_consent,
        profile_image_url: contact.profile_image_url || null,
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from('crm_contacts')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Contact created');
    },
    onError: (error) => {
      toast.error('Failed to create contact: ' + error.message);
    },
  });
}

export function useUpdateCRMContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMContact> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contact', data.id] });
      toast.success('Contact updated');
    },
    onError: (error) => {
      toast.error('Failed to update contact: ' + error.message);
    },
  });
}

export function useDeleteCRMContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Contact deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete contact: ' + error.message);
    },
  });
}

export function useBulkDeleteCRMContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('crm_contacts')
        .delete()
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      toast.success('Contacts deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete contacts: ' + error.message);
    },
  });
}
