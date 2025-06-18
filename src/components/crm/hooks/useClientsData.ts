
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseClientsDataProps {
  searchTerm: string;
  statusFilter: string;
  selectedListId?: string;
}

export function useClientsData({ searchTerm, statusFilter, selectedListId }: UseClientsDataProps) {
  // Fetch clients with optional list filtering
  const clientsQuery = useQuery({
    queryKey: ['clients', searchTerm, statusFilter, selectedListId],
    queryFn: async () => {
      let clientsData: any[] = [];

      if (selectedListId) {
        // Query for clients in a specific list
        const { data, error } = await supabase
          .from('client_list_members')
          .select(`
            client_id,
            clients:client_id (*)
          `)
          .eq('list_id', selectedListId);
        
        if (error) throw error;

        // Extract clients from the nested structure
        clientsData = data?.map((item: any) => item.clients).filter(Boolean) || [];
      } else {
        // Query for all clients
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .order('full_name');
        
        if (error) throw error;
        clientsData = data || [];
      }

      // Apply search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        clientsData = clientsData.filter((client: any) =>
          client.full_name?.toLowerCase().includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.company?.toLowerCase().includes(searchLower)
        );
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        clientsData = clientsData.filter((client: any) => client.status === statusFilter);
      }

      return clientsData;
    }
  });

  // Fetch client list memberships for each client
  const membershipQuery = useQuery({
    queryKey: ['client-list-memberships'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_list_members')
        .select('client_id, list_id');
      
      if (error) throw error;
      
      // Group by client_id
      const memberships: Record<string, string[]> = {};
      data.forEach(item => {
        if (!memberships[item.client_id]) {
          memberships[item.client_id] = [];
        }
        memberships[item.client_id].push(item.list_id);
      });
      
      return memberships;
    }
  });

  return {
    clients: clientsQuery.data,
    isLoading: clientsQuery.isLoading,
    error: clientsQuery.error,
    clientListMemberships: membershipQuery.data
  };
}
