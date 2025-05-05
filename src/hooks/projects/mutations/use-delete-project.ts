
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, itemDetails }: { id: string, itemDetails: any }) => {
      if (isAdmin) {
        // Admin can delete directly
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
      } else {
        // Non-admin creates a deletion request
        const { error } = await supabase
          .from('deletion_requests')
          .insert({
            item_id: id,
            item_type: 'projects',
            item_details: itemDetails,
            user_id: (await supabase.auth.getUser()).data.user?.id
          });
        
        if (error) throw error;
      }
      
      return { id };
    },
    onSuccess: (_, variables) => {
      if (isAdmin) {
        toast.success("Project deleted successfully");
      } else {
        toast.success("Deletion request submitted for review");
      }
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error) => {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  });
}
