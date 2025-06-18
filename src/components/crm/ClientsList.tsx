
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClientCard } from "./ClientCard";
import { EditClientDialog } from "./EditClientDialog";
import { ClientDetailsDialog } from "./ClientDetailsDialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ClientsListProps {
  searchTerm: string;
  statusFilter: string;
  selectedListId?: string;
}

export function ClientsList({ searchTerm, statusFilter, selectedListId }: ClientsListProps) {
  const [editingClient, setEditingClient] = useState<any>(null);
  const [detailsClient, setDetailsClient] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch clients with optional list filtering
  const { data: clients, isLoading, error } = useQuery({
    queryKey: ['clients', searchTerm, statusFilter, selectedListId],
    queryFn: async () => {
      let query = supabase
        .from('clients')
        .select('*');

      // If a list is selected, filter by list membership
      if (selectedListId) {
        query = supabase
          .from('client_list_members')
          .select(`
            client_id,
            clients:client_id (*)
          `)
          .eq('list_id', selectedListId);
      }

      const { data, error } = await query.order('full_name');
      
      if (error) throw error;

      // Extract clients from the data structure if filtering by list
      let clientsData = selectedListId 
        ? data?.map((item: any) => item.clients).filter(Boolean) || []
        : data || [];

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
  const { data: clientListMemberships } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-list-memberships'] });
      toast.success('Client deleted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to delete client: ${error.message}`);
    }
  });

  const handleDelete = (clientId: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      deleteMutation.mutate(clientId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500 mb-4">Failed to load clients</p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground mb-4">
          {selectedListId 
            ? "No clients found in this list"
            : searchTerm || statusFilter !== 'all'
            ? "No clients match your search criteria"
            : "No clients found"
          }
        </p>
        {!selectedListId && !searchTerm && statusFilter === 'all' && (
          <p className="text-sm text-muted-foreground">
            Create your first client to get started
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clients.map((client: any) => (
          <ClientCard
            key={client.id}
            client={client}
            onEdit={setEditingClient}
            onDelete={handleDelete}
            onViewDetails={setDetailsClient}
            clientListIds={clientListMemberships?.[client.id] || []}
          />
        ))}
      </div>

      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={() => setEditingClient(null)}
        />
      )}

      {detailsClient && (
        <ClientDetailsDialog
          client={detailsClient}
          open={!!detailsClient}
          onOpenChange={() => setDetailsClient(null)}
        />
      )}
    </>
  );
}
