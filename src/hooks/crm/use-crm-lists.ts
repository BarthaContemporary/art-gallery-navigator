import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CRMList, CRMListMember, CRMListType } from "@/types/crm";
import { toast } from "sonner";

interface UseListsOptions {
  type?: CRMListType | 'all';
}

export function useCRMLists(options: UseListsOptions = {}) {
  const { type } = options;

  return useQuery({
    queryKey: ['crm-lists', type],
    queryFn: async () => {
      let query = supabase
        .from('crm_lists')
        .select('*')
        .order('display_order', { ascending: true });

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get member counts for each list
      const listsWithCounts = await Promise.all(
        (data || []).map(async (list) => {
          const { count } = await supabase
            .from('crm_list_members')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id);
          
          return { ...list, member_count: count || 0 } as CRMList;
        })
      );

      return listsWithCounts;
    },
  });
}

export function useCRMList(id: string | undefined) {
  return useQuery({
    queryKey: ['crm-list', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('crm_lists')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Get member count
      const { count } = await supabase
        .from('crm_list_members')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', id);

      return { ...data, member_count: count || 0 } as CRMList;
    },
    enabled: !!id,
  });
}

export function useCRMListMembers(listId: string | undefined) {
  return useQuery({
    queryKey: ['crm-list-members', listId],
    queryFn: async () => {
      if (!listId) return [];
      
      const { data, error } = await supabase
        .from('crm_list_members')
        .select(`
          *,
          contact:crm_contacts(*)
        `)
        .eq('list_id', listId)
        .order('added_at', { ascending: false });

      if (error) throw error;
      return data as CRMListMember[];
    },
    enabled: !!listId,
  });
}

export function useCreateCRMList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (list: Partial<CRMList>) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const insertData = {
        name: list.name || '',
        description: list.description,
        type: list.type,
        filter_rules: list.filter_rules,
        display_order: list.display_order,
        created_by: userData.user?.id,
      };
      
      const { data, error } = await supabase
        .from('crm_lists')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-lists'] });
      toast.success('List created');
    },
    onError: (error) => {
      toast.error('Failed to create list: ' + error.message);
    },
  });
}

export function useUpdateCRMList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CRMList> & { id: string }) => {
      const { data, error } = await supabase
        .from('crm_lists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['crm-lists'] });
      queryClient.invalidateQueries({ queryKey: ['crm-list', data.id] });
      toast.success('List updated');
    },
    onError: (error) => {
      toast.error('Failed to update list: ' + error.message);
    },
  });
}

export function useDeleteCRMList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('crm_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-lists'] });
      toast.success('List deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete list: ' + error.message);
    },
  });
}

export function useAddContactsToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, contactIds }: { listId: string; contactIds: string[] }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const members = contactIds.map(contactId => ({
        list_id: listId,
        contact_id: contactId,
        added_by: userData.user?.id,
      }));

      const { error } = await supabase
        .from('crm_list_members')
        .upsert(members, { onConflict: 'list_id,contact_id' });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-lists'] });
      queryClient.invalidateQueries({ queryKey: ['crm-list', variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['crm-list-members', variables.listId] });
      toast.success('Contacts added to list');
    },
    onError: (error) => {
      toast.error('Failed to add contacts: ' + error.message);
    },
  });
}

export function useRemoveContactFromList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ listId, contactId }: { listId: string; contactId: string }) => {
      const { error } = await supabase
        .from('crm_list_members')
        .delete()
        .eq('list_id', listId)
        .eq('contact_id', contactId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['crm-lists'] });
      queryClient.invalidateQueries({ queryKey: ['crm-list', variables.listId] });
      queryClient.invalidateQueries({ queryKey: ['crm-list-members', variables.listId] });
      toast.success('Contact removed from list');
    },
    onError: (error) => {
      toast.error('Failed to remove contact: ' + error.message);
    },
  });
}

export function useReorderCRMLists() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lists: { id: string; display_order: number }[]) => {
      const updates = lists.map(({ id, display_order }) =>
        supabase
          .from('crm_lists')
          .update({ display_order })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-lists'] });
    },
    onError: (error) => {
      toast.error('Failed to reorder lists: ' + error.message);
    },
  });
}
