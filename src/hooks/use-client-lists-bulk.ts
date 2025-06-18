
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAddMultipleClientsToList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ clientIds, listId }: { clientIds: string[]; listId: string }) => {
      const insertData = clientIds.map(clientId => ({
        client_id: clientId,
        list_id: listId
      }));

      const { error } = await supabase
        .from('client_list_members')
        .insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: (_, { clientIds }) => {
      queryClient.invalidateQueries({ queryKey: ['client-list-members'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(`Added ${clientIds.length} client${clientIds.length === 1 ? '' : 's'} to list`);
    },
    onError: (error) => {
      toast.error(`Failed to add clients: ${error.message}`);
    }
  });
}

export function useRemoveMultipleClientsFromList() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ clientIds, listId }: { clientIds: string[]; listId: string }) => {
      const { error } = await supabase
        .from('client_list_members')
        .delete()
        .eq('list_id', listId)
        .in('client_id', clientIds);
      
      if (error) throw error;
    },
    onSuccess: (_, { clientIds }) => {
      queryClient.invalidateQueries({ queryKey: ['client-list-members'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(`Removed ${clientIds.length} client${clientIds.length === 1 ? '' : 's'} from list`);
    },
    onError: (error) => {
      toast.error(`Failed to remove clients: ${error.message}`);
    }
  });
}

export function useCreateClientListWithMembers() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      name: string; 
      description?: string; 
      clientIds: string[] 
    }) => {
      // First create the list
      const { data: list, error: listError } = await supabase
        .from('client_lists')
        .insert({ 
          name: data.name, 
          description: data.description 
        })
        .select()
        .single();
      
      if (listError) throw listError;

      // Then add clients if any were selected
      if (data.clientIds.length > 0) {
        const membersData = data.clientIds.map(clientId => ({
          client_id: clientId,
          list_id: list.id
        }));

        const { error: membersError } = await supabase
          .from('client_list_members')
          .insert(membersData);
        
        if (membersError) throw membersError;
      }

      return { list, memberCount: data.clientIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['client-lists'] });
      queryClient.invalidateQueries({ queryKey: ['client-list-members'] });
      
      const memberText = result.memberCount > 0 
        ? ` with ${result.memberCount} member${result.memberCount === 1 ? '' : 's'}`
        : '';
      toast.success(`Client list created successfully${memberText}`);
    },
    onError: (error) => {
      toast.error(`Failed to create list: ${error.message}`);
    }
  });
}
