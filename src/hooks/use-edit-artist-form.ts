import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RepresentationStatus = "represented" | "formerly represented" | "not represented";

export interface EditArtistForm {
  full_name: string;
  surname_first_letter?: string; // New field
  birth_year?: number;
  death_year?: number; // New field
  place_of_birth?: string; // New field
  place_of_death?: string; // New field
  nationality?: string;
  biography?: string;
  image?: FileList;
  representation_status: RepresentationStatus;
  email?: string;
}

interface UseEditArtistFormProps {
  artist: {
    id: string;
    full_name: string;
    surname_first_letter?: string | null; // New field
    birth_year: number | null;
    death_year?: number | null; // New field
    place_of_birth?: string | null; // New field
    place_of_death?: string | null; // New field
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

  const form = useForm<EditArtistForm>({
    defaultValues: {
      full_name: artist.full_name,
      surname_first_letter: artist.surname_first_letter || "", // New field
      birth_year: artist.birth_year || undefined,
      death_year: artist.death_year || undefined, // New field
      place_of_birth: artist.place_of_birth || "", // New field
      place_of_death: artist.place_of_death || "", // New field
      nationality: artist.nationality || "",
      biography: artist.biography || "",
      representation_status: (artist.representation_status as RepresentationStatus) || "not represented",
      email: artist.email || "",
    },
  });

  const onSubmit = async (data: EditArtistForm) => {
    try {
      setIsLoading(true);
      let image_url = artist.image_url;

      if (data.image && data.image.length > 0) {
        const imageFile = data.image[0];
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('gallery_images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('gallery_images')
          .getPublicUrl(filePath);

        image_url = publicUrl;
      }

      const { error } = await supabase.from('artists').update({
        full_name: data.full_name,
        surname_first_letter: data.surname_first_letter || null, // New field
        birth_year: data.birth_year ?? null,
        death_year: data.death_year ?? null, // New field
        place_of_birth: data.place_of_birth || null, // New field
        place_of_death: data.place_of_death || null, // New field
        nationality: data.nationality ?? null,
        biography: data.biography ?? null,
        representation_status: data.representation_status,
        image_url,
        email: data.email || null,
      }).eq('id', artist.id);

      if (error) throw error;

      toast.success("Artist updated successfully");
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      onSuccess();
      form.reset();
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to update artist");
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
