
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReferenceWithName } from "@/components/projects/task-dialog/TaskReferencesField";

// Function to fetch reference details from various tables
const fetchReferenceDetails = async (referenceType: string, referenceId: string): Promise<ReferenceWithName | null> => {
  try {
    switch (referenceType) {
      case 'artwork':
        const { data: artwork } = await supabase
          .from('artworks')
          .select('id, title')
          .eq('id', referenceId)
          .single();
        return artwork ? { id: artwork.id, type: 'artwork', name: artwork.title } : null;
      
      case 'artist':
        const { data: artist } = await supabase
          .from('artists')
          .select('id, full_name')
          .eq('id', referenceId)
          .single();
        return artist ? { id: artist.id, type: 'artist', name: artist.full_name } : null;
      
      case 'collection':
        const { data: collection } = await supabase
          .from('collections')
          .select('id, name')
          .eq('id', referenceId)
          .single();
        return collection ? { id: collection.id, type: 'collection', name: collection.name } : null;
      
      case 'document':
        const { data: document } = await supabase
          .from('documents')
          .select('id, file_name')
          .eq('id', referenceId)
          .single();
        return document ? { id: document.id, type: 'document', name: document.file_name } : null;
      
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error fetching reference details for ${referenceType} ${referenceId}:`, error);
    return null;
  }
};

// Hook to get task references with names
export function useTaskReferences(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task-references', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      
      // First get the references from project_task_references
      const { data: taskReferences, error } = await supabase
        .from('project_task_references')
        .select('*')
        .eq('task_id', taskId);
      
      if (error) throw error;
      
      // If there are no references, return empty array
      if (!taskReferences || taskReferences.length === 0) return [];
      
      // Fetch details for each reference
      const referencesWithDetails = await Promise.all(
        taskReferences.map(async (ref) => {
          const referenceWithName = await fetchReferenceDetails(ref.reference_type, ref.reference_id);
          return referenceWithName;
        })
      );
      
      // Filter out any null values from failed lookups
      return referencesWithDetails.filter(Boolean) as ReferenceWithName[];
    },
    enabled: !!taskId
  });
}
