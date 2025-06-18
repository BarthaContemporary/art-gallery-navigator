
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClientFormData {
  full_name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  website: string;
  linkedin_handle: string;
  instagram_handle: string;
  status: 'active' | 'inactive' | 'prospect' | 'lead' | 'customer';
  client_type: string;
  source: string;
  birthday: string;
  notes: string;
  tags: string[];
  interested_artists: string[];
  profile_image_url: string;
}

const initialFormData: ClientFormData = {
  full_name: '',
  email: '',
  phone: '',
  company: '',
  address: '',
  website: '',
  linkedin_handle: '',
  instagram_handle: '',
  status: 'prospect',
  client_type: 'collector',
  source: '',
  birthday: '',
  notes: '',
  tags: [],
  interested_artists: [],
  profile_image_url: '',
};

export function useCreateClientForm() {
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const queryClient = useQueryClient();

  const createClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { error } = await supabase
        .from('clients')
        .insert({
          full_name: data.full_name,
          email: data.email || null,
          phone: data.phone || null,
          company: data.company || null,
          address: data.address || null,
          website: data.website || null,
          linkedin_handle: data.linkedin_handle || null,
          instagram_handle: data.instagram_handle || null,
          status: data.status,
          client_type: data.client_type,
          source: data.source || null,
          birthday: data.birthday || null,
          notes: data.notes || null,
          tags: data.tags.length > 0 ? data.tags : null,
          interested_artists: data.interested_artists.length > 0 ? data.interested_artists : null,
          profile_image_url: data.profile_image_url || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Client created successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      resetForm();
    },
    onError: (error) => {
      console.error('Error creating client:', error);
      toast.error('Failed to create client');
    }
  });

  const updateFormData = (updates: Partial<ClientFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const resetForm = () => {
    setFormData(initialFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    createClientMutation.mutate(formData);
  };

  return {
    formData,
    updateFormData,
    handleSubmit,
    resetForm,
    isLoading: createClientMutation.isPending
  };
}
