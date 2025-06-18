
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClientFormData } from "./useCreateClientForm";

interface UseEditClientFormProps {
  client: any;
  onSuccess: () => void;
}

export function useEditClientForm({ client, onSuccess }: UseEditClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>({
    full_name: '',
    email: '',
    phone: '',
    company: '',
    website: '',
    status: 'prospect',
    client_type: 'collector',
    address: '',
    notes: '',
    source: '',
    interested_artists: [],
    instagram_handle: '',
    linkedin_handle: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (client) {
      setFormData({
        full_name: client.full_name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        website: client.website || '',
        status: client.status || 'prospect',
        client_type: client.client_type || 'collector',
        address: client.address || '',
        notes: client.notes || '',
        source: client.source || '',
        interested_artists: client.interested_artists || [],
        instagram_handle: client.instagram_handle || '',
        linkedin_handle: client.linkedin_handle || ''
      });
    }
  }, [client]);

  const updateClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { error } = await supabase
        .from('clients')
        .update(data)
        .eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Client updated successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      onSuccess();
    },
    onError: (error) => {
      toast.error('Failed to update client');
      console.error('Error updating client:', error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    updateClientMutation.mutate(formData);
  };

  const updateFormData = (updates: Partial<ClientFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  return {
    formData,
    updateFormData,
    handleSubmit,
    isLoading: updateClientMutation.isPending
  };
}
