
import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ClientFormData } from './useCreateClientForm';

interface UseEditClientFormProps {
  client: any;
  onSuccess?: () => void;
}

export function useEditClientForm({ client, onSuccess }: UseEditClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>({
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
  });
  
  const queryClient = useQueryClient();

  useEffect(() => {
    if (client) {
      setFormData({
        full_name: client.full_name || '',
        email: client.email || '',
        phone: client.phone || '',
        company: client.company || '',
        address: client.address || '',
        website: client.website || '',
        linkedin_handle: client.linkedin_handle || '',
        instagram_handle: client.instagram_handle || '',
        status: client.status || 'prospect',
        client_type: client.client_type || 'collector',
        source: client.source || '',
        birthday: client.birthday || '',
        notes: client.notes || '',
        tags: client.tags || [],
        interested_artists: client.interested_artists || [],
        profile_image_url: client.profile_image_url || '',
      });
    }
  }, [client]);

  const updateClientMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const { error } = await supabase
        .from('clients')
        .update({
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
          updated_at: new Date().toISOString(),
        })
        .eq('id', client.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Client updated successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Error updating client:', error);
      toast.error('Failed to update client');
    }
  });

  const updateFormData = (updates: Partial<ClientFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }
    updateClientMutation.mutate(formData);
  };

  return {
    formData,
    updateFormData,
    handleSubmit,
    isLoading: updateClientMutation.isPending
  };
}
