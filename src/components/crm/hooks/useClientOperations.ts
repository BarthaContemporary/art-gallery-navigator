
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useClientOperations() {
  const queryClient = useQueryClient();

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

  return {
    handleDelete,
    getStatusColor,
    isDeleting: deleteMutation.isPending
  };
}
