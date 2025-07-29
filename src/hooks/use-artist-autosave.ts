import { useCallback } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useAutosave } from './use-autosave';
import { EditArtistFormValues } from '@/schemas/artistSchema';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UseArtistAutosaveProps {
  form: UseFormReturn<EditArtistFormValues>;
  artistId: string;
  enabled?: boolean;
}

export function useArtistAutosave({ 
  form, 
  artistId, 
  enabled = true 
}: UseArtistAutosaveProps) {
  const queryClient = useQueryClient();

  const saveArtist = useCallback(async (data: EditArtistFormValues) => {
    // Skip autosave if essential fields are missing
    if (!data.full_name?.trim()) {
      return;
    }

    try {
      const updateData = {
        full_name: data.full_name.trim(),
        surname_first_letter: data.surname_first_letter?.trim() || null,
        birth_year: data.birth_year ?? null,
        death_year: data.death_year ?? null,
        place_of_birth: data.place_of_birth?.trim() || null,
        place_of_death: data.place_of_death?.trim() || null,
        nationality: data.nationality?.trim() || null,
        biography: data.biography?.trim() || null,
        representation_status: data.representation_status,
        email: data.email?.trim() || null,
      };

      const { error } = await supabase
        .from('artists')
        .update(updateData)
        .eq('id', artistId);

      if (error) throw error;

      // Silently update the cache
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', artistId] });
      
    } catch (error) {
      console.error('Autosave failed:', error);
      // Don't show toast for autosave failures to avoid spam
    }
  }, [artistId, queryClient]);

  const { triggerSave } = useAutosave({
    form,
    onSave: saveArtist,
    delay: 2000,
    enabled
  });

  return { triggerSave };
}