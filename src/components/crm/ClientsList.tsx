
import { useState } from "react";
import { EditClientDialog } from "./EditClientDialog";
import { ClientDetailsDialog } from "./ClientDetailsDialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ClientItem } from "./ClientItem";
import { ClientsEmptyState } from "./ClientsEmptyState";
import { useClientsData } from "./hooks/useClientsData";
import { useClientOperations } from "./hooks/useClientOperations";

interface ClientsListProps {
  searchTerm: string;
  statusFilter: string;
  selectedListId?: string;
}

export function ClientsList({ searchTerm, statusFilter, selectedListId }: ClientsListProps) {
  const [editingClient, setEditingClient] = useState<any>(null);
  const [detailsClient, setDetailsClient] = useState<any>(null);
  
  const { clients, isLoading, error } = useClientsData({ 
    searchTerm, 
    statusFilter, 
    selectedListId 
  });
  
  const { handleDelete, getStatusColor } = useClientOperations();

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
      <ClientsEmptyState 
        selectedListId={selectedListId}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
      />
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">
          {clients.length} client{clients.length === 1 ? '' : 's'} found
        </div>
      </div>

      <div className="space-y-2">
        {clients.map((client: any) => (
          <ClientItem
            key={client.id}
            client={client}
            onEdit={setEditingClient}
            onDelete={handleDelete}
            onViewDetails={setDetailsClient}
            getStatusColor={getStatusColor}
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
