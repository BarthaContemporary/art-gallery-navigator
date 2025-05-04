
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DeletionRequest {
  id: string;
  user_id: string;
  item_id: string;
  item_type: string;
  item_details: any;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export function useDeletionRequests() {
  const { data: deletionRequests, refetch: refetchDeletionRequests } = useQuery({
    queryKey: ['deletion-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deletion_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DeletionRequest[];
    },
  });

  const handleApproveDeletion = async (requestId: string, itemId: string, itemType: string) => {
    try {
      const { error: updateError } = await supabase
        .from('deletion_requests')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      let deleteError;
      
      if (itemType === 'artworks') {
        const { error } = await supabase.from('artworks').delete().eq('id', itemId);
        deleteError = error;
      } else if (itemType === 'documents') {
        const { error } = await supabase.from('documents').delete().eq('id', itemId);
        deleteError = error;
      } else if (itemType === 'collections') {
        const { error } = await supabase.from('collections').delete().eq('id', itemId);
        deleteError = error;
      } else if (itemType === 'locations') {
        const { error } = await supabase.from('locations').delete().eq('id', itemId);
        deleteError = error;
      } else if (itemType === 'projects') {
        const { error } = await supabase.from('projects').delete().eq('id', itemId);
        deleteError = error;
      } else {
        throw new Error(`Unsupported item type: ${itemType}`);
      }

      if (deleteError) throw deleteError;

      toast({
        title: "Deletion approved",
        description: "The item has been successfully deleted.",
      });

      refetchDeletionRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve deletion",
        variant: "destructive",
      });
    }
  };

  const handleRejectDeletion = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('deletion_requests')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Deletion rejected",
        description: "The deletion request has been rejected.",
      });

      refetchDeletionRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject deletion",
        variant: "destructive",
      });
    }
  };

  return {
    deletionRequests,
    handleApproveDeletion,
    handleRejectDeletion,
  };
}
