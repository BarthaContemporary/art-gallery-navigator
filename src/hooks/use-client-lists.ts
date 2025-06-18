
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClientList {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientListMember {
  id: string;
  client_id: string;
  list_id: string;
  added_at: string;
}

export function useClientLists() {
  return useQuery({
    queryKey: ['client-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_lists')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as ClientList[];
    }
  });
}

export function useClientListMembers(listId?: string) {
  return useQuery({
    queryKey: ['client-list-members', listId],
    queryFn: async () => {
      if (!listId) return [];
      
      const { data, error } = await supabase
        .from('client_list_members')
        .select(`
          *,
          clients:client_id (
            id,
            full_name,
            email,
            status
          )
        `)
        .eq('list_id', listId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!listId
  });
}

export function useCreateClientList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const { data: result, error } = await supabase
        .from('client_lists')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-lists'] });
      toast.success('Client list created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create list: ${error.message}`);
    }
  });
}

export function useUpdateClientList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { id: string; name: string; description?: string }) => {
      const { data: result, error } = await supabase
        .from('client_lists')
        .update({ 
          name: data.name, 
          description: data.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-lists'] });
      toast.success('Client list updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update list: ${error.message}`);
    }
  });
}

export function useDeleteClientList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase
        .from('client_lists')
        .delete()
        .eq('id', listId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-lists'] });
      queryClient.invalidateQueries({ queryKey: ['client-list-members'] });
      toast.success('Client list deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete list: ${error.message}`);
    }
  });
}

export function useAddClientToList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ clientId, listId }: { clientId: string; listId: string }) => {
      const { error } = await supabase
        .from('client_list_members')
        .insert({ client_id: clientId, list_id: listId });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-list-members'] });
      toast.success('Client added to list');
    },
    onError: (error) => {
      toast.error(`Failed to add client: ${error.message}`);
    }
  });
}

export function useRemoveClientFromList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ clientId, listId }: { clientId: string; listId: string }) => {
      const { error } = await supabase
        .from('client_list_members')
        .delete()
        .eq('client_id', clientId)
        .eq('list_id', listId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-list-members'] });
      toast.success('Client removed from list');
    },
    onError: (error) => {
      toast.error(`Failed to remove client: ${error.message}`);
    }
  });
}
