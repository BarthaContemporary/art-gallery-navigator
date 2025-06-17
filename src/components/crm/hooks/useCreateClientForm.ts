
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ClientStatus = 'active' | 'inactive' | 'prospect' | 'lead' | 'customer';

export interface ClientFormData {
  full_name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  status: ClientStatus;
  client_type: string;
  address: string;
  notes: string;
  source: string;
  interested_artists: string[];
}

const initialFormData: ClientFormData = {
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
  interested_artists: []
};

export function useCreateClientForm() {
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const queryClient = useQueryClient();

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { error } = await supabase.from('clients').insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Client created successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['crm-stats'] });
      setFormData(initialFormData);
    },
    onError: (error) => {
      toast.error('Failed to create client');
      console.error('Error creating client:', error);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    createClientMutation.mutate(formData);
  };

  const updateFormData = (updates: Partial<ClientFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
  };

  return {
    formData,
    updateFormData,
    handleSubmit,
    resetForm,
    isLoading: createClientMutation.isPending
  };
}
