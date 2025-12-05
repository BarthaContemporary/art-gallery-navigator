import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMContact, CRMContactType } from "@/types/crm";
import { toast } from "sonner";

interface UseContactsOptions {
  searchTerm?: string;
  contactType?: CRMContactType | 'all';
  tags?: string[];
  listId?: string;
}

export function useCRMContacts(options: UseContactsOptions = {}) {
  const { searchTerm, contactType, tags, listId } = options;

  return useQuery({
    queryKey: ['crm-contacts', searchTerm, contactType, tags, listId],
    queryFn: async () => {
      let query = supabase
        .from('crm_contacts')
        .select(`
          *,
          organization:crm_organizations(*)
        `)
        .order('full_name', { ascending: true });

      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      if (contactType && contactType !== 'all') {
        query = query.eq('contact_type', contactType);
      }

      if (tags && tags.length > 0) {
        query = query.overlaps('tags', tags);
      }

      const { data, error } = await query;

      if (error) throw error;

      // If filtering by list, get members and filter
      if (listId) {
        const { data: members, error: membersError } = await supabase
          .from('crm_list_members')
          .select('contact_id')
          .eq('list_id', listId);

        if (membersError) throw membersError;
        
        const memberIds = new Set(members?.map(m => m.contact_id) || []);
        return (data || []).filter(c => memberIds.has(c.id)) as CRMContact[];
      }

      return data as CRMContact[];
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
        email: contact.email,
        phone: contact.phone,
        address_line1: contact.address_line1,
        city: contact.city,
        country: contact.country,
        instagram_handle: contact.instagram_handle,
        linkedin_handle: contact.linkedin_handle,
        whatsapp_number: contact.whatsapp_number,
        line_id: contact.line_id,
        wechat_id: contact.wechat_id,
        job_title: contact.job_title,
        organization_id: contact.organization_id,
        contact_type: contact.contact_type,
        status: contact.status,
        source: contact.source,
        tags: contact.tags,
        notes: contact.notes,
        birthday: contact.birthday,
        marketing_consent: contact.marketing_consent,
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
