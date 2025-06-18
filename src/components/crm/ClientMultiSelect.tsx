
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Users, CheckSquare, Square } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClientMultiSelectProps {
  selectedClientIds: string[];
  onSelectionChange: (clientIds: string[]) => void;
  excludeClientIds?: string[];
}

export function ClientMultiSelect({ 
  selectedClientIds, 
  onSelectionChange, 
  excludeClientIds = [] 
}: ClientMultiSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ['all-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, full_name, email, status, client_type')
        .order('full_name');
      
      if (error) throw error;
      return data;
    }
  });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    
    return clients
      .filter(client => !excludeClientIds.includes(client.id))
      .filter(client => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
          client.full_name?.toLowerCase().includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower)
        );
      });
  }, [clients, searchTerm, excludeClientIds]);

  const handleSelectAll = () => {
    const allFilteredIds = filteredClients.map(client => client.id);
    const newSelection = selectedClientIds.length === allFilteredIds.length 
      ? [] 
      : allFilteredIds;
    onSelectionChange(newSelection);
  };

  const handleClientToggle = (clientId: string) => {
    const newSelection = selectedClientIds.includes(clientId)
      ? selectedClientIds.filter(id => id !== clientId)
      : [...selectedClientIds, clientId];
    onSelectionChange(newSelection);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer':
        return 'text-green-600 bg-green-50';
      case 'prospect':
        return 'text-yellow-600 bg-yellow-50';
      case 'inactive':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Loading clients...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {filteredClients.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedClientIds.length} of {filteredClients.length} clients selected
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="h-8"
            >
              {selectedClientIds.length === filteredClients.length ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              {selectedClientIds.length === filteredClients.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="h-64 border rounded-md">
        <div className="p-4 space-y-2">
          {filteredClients.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {searchTerm ? 'No clients match your search' : 'No clients available'}
            </div>
          ) : (
            filteredClients.map((client) => (
              <div
                key={client.id}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => handleClientToggle(client.id)}
              >
                <Checkbox
                  checked={selectedClientIds.includes(client.id)}
                  onChange={() => handleClientToggle(client.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{client.full_name}</span>
                    <Badge className={`text-xs ${getStatusColor(client.status)}`}>
                      {client.status}
                    </Badge>
                  </div>
                  {client.email && (
                    <div className="text-sm text-muted-foreground truncate">
                      {client.email}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {client.client_type}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
