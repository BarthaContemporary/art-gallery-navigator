
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Edit, MoreHorizontal, RotateCw, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { ClientDetailsDialog } from "./ClientDetailsDialog";
import { EditClientDialog } from "./EditClientDialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClientsListProps {
  searchTerm: string;
  statusFilter: string;
}

type ClientStatus = 'active' | 'inactive' | 'prospect' | 'lead' | 'customer';

export function ClientsList({ searchTerm, statusFilter }: ClientsListProps) {
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [editingClient, setEditingClient] = useState<any>(null);
  const queryClient = useQueryClient();

  // Campaign Monitor Client ID
  const CAMPAIGN_MONITOR_CLIENT_ID = "129353";

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

  // Sync single client mutation
  const syncClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/functions/v1/campaign-monitor-sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_client',
          clientId,
          campaignMonitorClientId: CAMPAIGN_MONITOR_CLIENT_ID,
          listId: 'main-list'
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Client synced to Campaign Monitor successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (error) => {
      toast.error(`Sync failed: ${error.message}`);
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer': return 'bg-green-100 text-green-800';
      case 'prospect': return 'bg-yellow-100 text-yellow-800';
      case 'lead': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-emerald-100 text-emerald-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'synced': return <CheckCircle className="h-3 w-3" />;
      case 'error': return <AlertCircle className="h-3 w-3" />;
      case 'pending': return <Clock className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

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
          <Card key={client.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{client.full_name}</h3>
                    <Badge className={getStatusColor(client.status)}>
                      {client.status}
                    </Badge>
                    {client.cm_sync_status && (
                      <Badge className={getSyncStatusColor(client.cm_sync_status)} variant="outline">
                        {getSyncStatusIcon(client.cm_sync_status)}
                        <span className="ml-1 text-xs">CM</span>
                      </Badge>
                    )}
                    {client.tags && client.tags.length > 0 && (
                      <div className="flex gap-1">
                        {client.tags.slice(0, 2).map((tag: string, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {client.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{client.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 text-sm text-muted-foreground">
                    {client.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {client.email}
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </div>
                    )}
                    {client.company && (
                      <div className="text-sm">
                        {client.company}
                      </div>
                    )}
                  </div>

                  {client.notes && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <span className="font-medium">Notes:</span> {client.notes.length > 100 ? `${client.notes.substring(0, 100)}...` : client.notes}
                    </div>
                  )}

                  {client.cm_sync_error && (
                    <div className="mt-2 text-xs text-red-600">
                      CM Sync Error: {client.cm_sync_error}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedClient(client)}
                  >
                    View Details
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setEditingClient(client)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Client
                      </DropdownMenuItem>
                      {client.email && (
                        <DropdownMenuItem 
                          onClick={() => syncClientMutation.mutate(client.id)}
                          disabled={syncClientMutation.isPending}
                        >
                          <RotateCw className="h-4 w-4 mr-2" />
                          Sync to Campaign Monitor
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
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
