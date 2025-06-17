
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ClientDetailsDialog } from "./ClientDetailsDialog";
import { EditClientDialog } from "./EditClientDialog";
import { ClientCard } from "./ClientCard";
import { useSyncClientMutation } from "./hooks/useSyncClientMutation";

interface ClientsListProps {
  searchTerm: string;
  statusFilter: string;
}

type ClientStatus = 'active' | 'inactive' | 'prospect' | 'lead' | 'customer';

export function ClientsList({ searchTerm, statusFilter }: ClientsListProps) {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const syncClientMutation = useSyncClientMutation();

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', searchTerm, statusFilter],
    queryFn: async () => {
      let query = supabase.from('clients').select('*');

      if (searchTerm) {
        // Enhanced search to include notes field
        query = query.or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as ClientStatus);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading clients...</div>;
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No clients found. Create your first client to get started.
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {clients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onViewDetails={setSelectedClient}
            onEdit={setEditingClient}
            onSync={syncClientMutation.mutate}
            isSyncing={syncClientMutation.isPending}
          />
        ))}
      </div>

      <ClientDetailsDialog
        client={selectedClient}
        open={!!selectedClient}
        onOpenChange={(open) => !open && setSelectedClient(null)}
      />

      <EditClientDialog
        client={editingClient}
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
      />
    </>
  );
}
