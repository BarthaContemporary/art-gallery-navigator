
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseClientsDataProps {
  searchTerm: string;
  statusFilter: string;
}

export function useClientsData({ searchTerm, statusFilter }: UseClientsDataProps) {
  // Fetch all clients
  const clientsQuery = useQuery({
    queryKey: ['clients', searchTerm, statusFilter],
    queryFn: async () => {
      // Query for all clients
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      let clientsData = data || [];

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
