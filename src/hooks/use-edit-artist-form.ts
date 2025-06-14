
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { EditArtistFormValues, editArtistSchema, representationStatusSchema } from "@/schemas/artistSchema";

// Remove previous EditArtistForm interface if it exists, use EditArtistFormValues from schema

interface UseEditArtistFormProps {
  artist: {
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
    representation_status: string | null;
    email?: string | null;
  };
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
      birth_year: artist.birth_year || undefined,
      death_year: artist.death_year || undefined,
      place_of_birth: artist.place_of_birth || "",
      place_of_death: artist.place_of_death || "",
      nationality: artist.nationality || "",
      biography: artist.biography || "",
      representation_status: representationStatusSchema.parse(artist.representation_status || "not represented"),
      image: undefined,
    },
  });

  const onSubmit = async (data: EditArtistFormValues) => {
    try {
      setIsLoading(true);
      let image_url = artist.image_url;

      if (data.image && data.image.length > 0) {
        const imageFile = data.image[0];
        const fileExt = imageFile.name.split('.').pop();
        // Ensure unique file path, e.g., by prefixing with artist ID or a timestamp
        const filePath = `artist_images/${artist.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('gallery_images') // Consider a more specific bucket like 'artist_profile_images'
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('gallery_images')
          .getPublicUrl(filePath);

        image_url = publicUrl;

        // If there was an old image and a new one is uploaded, delete the old one from storage
        // This part needs careful implementation to avoid deleting if upload fails or if it's the same image_url
        if (artist.image_url && artist.image_url !== image_url) {
            // Extract path from old URL and delete. This is a simplified example.
            // Actual implementation might need to parse the URL more robustly.
            const oldFilePath = artist.image_url.substring(artist.image_url.lastIndexOf('gallery_images/') + 'gallery_images/'.length);
            if (oldFilePath) {
                 await supabase.storage.from('gallery_images').remove([oldFilePath]);
            }
        }
      }

      const updateData = {
        full_name: data.full_name,
        surname_first_letter: data.surname_first_letter || null,
        birth_year: data.birth_year ?? null,
        death_year: data.death_year ?? null,
        place_of_birth: data.place_of_birth || null,
        place_of_death: data.place_of_death || null,
        nationality: data.nationality || null,
        biography: data.biography || null,
        representation_status: data.representation_status,
        image_url,
        email: data.email || null,
      };
      
      // Ensure number fields are actual numbers or null
      if (data.birth_year === undefined || isNaN(Number(data.birth_year))) updateData.birth_year = null; else updateData.birth_year = Number(data.birth_year);
      if (data.death_year === undefined || isNaN(Number(data.death_year))) updateData.death_year = null; else updateData.death_year = Number(data.death_year);


      const { error } = await supabase.from('artists').update(updateData).eq('id', artist.id);

      if (error) throw error;

      toast.success("Artist updated successfully");
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['artist', artist.id] });
      onSuccess();
      // form.reset(); // Reset is handled by EditArtistDialog useEffect on open
    } catch (error: any) {
      console.error("Failed to update artist:", error);
      toast.error(error.message || "Failed to update artist. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    onSubmit: form.handleSubmit(onSubmit), // Use form.handleSubmit
  };
}
