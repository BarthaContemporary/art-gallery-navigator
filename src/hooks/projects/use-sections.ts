import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ProjectSection, 
  CreateSectionInput, 
  UpdateSectionInput,
  ReorderSectionsInput 
} from "./types/section-types";

// Default sections for a new project
const DEFAULT_SECTIONS = [
  { name: 'Backlog', color: '#6B7280', position: 0 },
  { name: 'To Do', color: '#3B82F6', position: 1 },
  { name: 'In Progress', color: '#F59E0B', position: 2 },
  { name: 'Done', color: '#10B981', position: 3 },
];

export function useProjectSections(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-sections', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_sections')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true });
      
      if (error) {
        console.error("Error fetching project sections:", error);
        throw error;
      }
      
      return data as ProjectSection[];
    },
    enabled: !!projectId,
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateSectionInput) => {
      const { data, error } = await supabase
        .from('project_sections')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data as ProjectSection;
    },
    onSuccess: (data) => {
      toast.success("Section created");
      queryClient.invalidateQueries({ queryKey: ['project-sections', data.project_id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create section: ${error.message}`);
    }
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: UpdateSectionInput) => {
      const { error } = await supabase
        .from('project_sections')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      toast.success("Section updated");
      queryClient.invalidateQueries({ queryKey: ['project-sections'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update section: ${error.message}`);
    }
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('project_sections')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      toast.success("Section deleted");
      queryClient.invalidateQueries({ queryKey: ['project-sections'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete section: ${error.message}`);
    }
  });
}

export function useReorderSections() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ project_id, sections }: ReorderSectionsInput) => {
      // Update all sections positions in a batch
      const updates = sections.map(({ id, position }) => 
        supabase
          .from('project_sections')
          .update({ position })
          .eq('id', id)
      );
      
      const results = await Promise.allSettled(updates);
      const errors = results.filter(r => r.status === 'rejected');
      
      if (errors.length > 0) {
        throw new Error('Failed to reorder some sections');
      }
      
      return { project_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-sections', data.project_id] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder sections: ${error.message}`);
    }
  });
}

export function useInitializeDefaultSections() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (projectId: string) => {
      // Check if sections already exist
      const { data: existing } = await supabase
        .from('project_sections')
        .select('id')
        .eq('project_id', projectId)
        .limit(1);
      
      if (existing && existing.length > 0) {
        return { projectId, created: false };
      }
      
      // Create default sections
      const sectionsToInsert = DEFAULT_SECTIONS.map(section => ({
        ...section,
        project_id: projectId
      }));
      
      const { error } = await supabase
        .from('project_sections')
        .insert(sectionsToInsert);
      
      if (error) throw error;
      return { projectId, created: true };
    },
    onSuccess: (data) => {
      if (data.created) {
        queryClient.invalidateQueries({ queryKey: ['project-sections', data.projectId] });
      }
    }
  });
}
