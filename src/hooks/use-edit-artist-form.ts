
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EditArtistFormValues, editArtistSchema, representationStatusSchema } from "@/schemas/artistSchema";

interface ArtistData { // Define a type for the artist data structure used in queries
  id: string;
  full_name: string;
  surname_first_letter?: string | null;
  birth_year: number | null;
  death_year?: number | null;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  nationality: string | null;
  biography: string | null;
  image_url: string | null;
  representation_status: string; // Assuming representation_status in query is string, not enum object
  email?: string | null;
  // Add other fields if they exist in your artist query data structure
}

interface UseEditArtistFormProps {
  artist: ArtistData; // Use the defined ArtistData type
  onSuccess: () => void;
}

export function useEditArtistForm({ artist, onSuccess }: UseEditArtistFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<EditArtistFormValues>({
    resolver: zodResolver(editArtistSchema),
    defaultValues: {
      full_name: artist.full_name || "",
      surname_first_letter: artist.surname_first_letter || "",
      email: artist.email || "",
      birth_year: artist.birth_year ?? undefined, // Use ?? for null/undefined
      death_year: artist.death_year ?? undefined,
      place_of_birth: artist.place_of_birth || "",
      place_of_death: artist.place_of_death || "",
      nationality: artist.nationality || "",
      biography: artist.biography || "",
      representation_status: representationStatusSchema.parse(artist.representation_status || "not represented"),
      image: undefined,
    },
  });

  const onSubmit = async (data: EditArtistFormValues) => {
    setIsLoading(true);
    let current_image_url = artist.image_url; // Use a different variable name to avoid conflict

    // Store previous data for potential rollback
    const artistQueryKey: QueryKey = ['artist', artist.id];
    const artistsListQueryKey: QueryKey = ['artists'];
    
    const previousArtistData = queryClient.getQueryData<ArtistData>(artistQueryKey);
    const previousArtistsListData = queryClient.getQueryData<ArtistData[]>(artistsListQueryKey);

    try {
      if (data.image && data.image.length > 0) {
        const imageFile = data.image[0];
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `artist_images/${artist.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('gallery_images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('gallery_images')
          .getPublicUrl(filePath);
        current_image_url = publicUrl;

        if (artist.image_url && artist.image_url !== current_image_url) {
            const oldFilePath = artist.image_url.substring(artist.image_url.lastIndexOf('gallery_images/') + 'gallery_images/'.length);
            if (oldFilePath) {
                 await supabase.storage.from('gallery_images').remove([oldFilePath]);
            }
        }
      }

      const updateDataForSupabase = {
        full_name: data.full_name,
        surname_first_letter: data.surname_first_letter || null,
        birth_year: data.birth_year ?? null,
        death_year: data.death_year ?? null,
        place_of_birth: data.place_of_birth || null,
        place_of_death: data.place_of_death || null,
        nationality: data.nationality || null,
        biography: data.biography || null,
        representation_status: data.representation_status,
        image_url: current_image_url,
        email: data.email || null,
      };
      
      // Ensure number fields are actual numbers or null - already handled by `?? null`
      // if (data.birth_year === undefined || isNaN(Number(data.birth_year))) updateDataForSupabase.birth_year = null; else updateDataForSupabase.birth_year = Number(data.birth_year);
      // if (data.death_year === undefined || isNaN(Number(data.death_year))) updateDataForSupabase.death_year = null; else updateDataForSupabase.death_year = Number(data.death_year);

      // Optimistic update
      const optimisticArtistView: ArtistData = {
        ...artist, // Original artist data
        ...updateDataForSupabase, // Apply changes
         representation_status: data.representation_status, // Ensure this is string
      };

      queryClient.setQueryData<ArtistData>(artistQueryKey, optimisticArtistView);
      if (previousArtistsListData) {
        queryClient.setQueryData<ArtistData[]>(artistsListQueryKey, (oldList) => 
          oldList ? oldList.map(a => a.id === artist.id ? optimisticArtistView : a) : [optimisticArtistView]
        );
      }
      
      const { error } = await supabase.from('artists').update(updateDataForSupabase).eq('id', artist.id);

      if (error) throw error; // This will be caught by the catch block

      toast.success("Artist updated successfully");
      // Invalidate queries on success to refetch from server and ensure consistency
      queryClient.invalidateQueries({ queryKey: artistsListQueryKey });
      queryClient.invalidateQueries({ queryKey: artistQueryKey });
      onSuccess();
    } catch (error: any) {
      console.error("Failed to update artist:", error);
      toast.error(error.message || "Failed to update artist. Check console for details.");
      // Rollback optimistic update
      if (previousArtistData) {
        queryClient.setQueryData(artistQueryKey, previousArtistData);
      }
      if (previousArtistsListData) {
        queryClient.setQueryData(artistsListQueryKey, previousArtistsListData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
