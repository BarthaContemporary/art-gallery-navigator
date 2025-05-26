
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, UseFormReturn, FieldErrors } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateArtistForm } from "../types";

interface UseCreateArtistFormProps {
  onSuccess: () => void;
}

interface UseCreateArtistFormReturn {
  form: UseFormReturn<CreateArtistForm>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  onSubmit: (data: CreateArtistForm) => Promise<void>;
  isLoading: boolean;
  errors: FieldErrors<CreateArtistForm>;
  resetForm: () => void;
}

export const useCreateArtistForm = ({ onSuccess }: UseCreateArtistFormProps): UseCreateArtistFormReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<CreateArtistForm>();
  const { handleSubmit: handleFormSubmit, reset, formState: { errors } } = form;

  const onSubmit = async (data: CreateArtistForm) => {
    try {
      setIsLoading(true);
      let image_url = null;

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

      const { error } = await supabase.from('artists').insert({
        full_name: data.full_name,
        surname_first_letter: data.surname_first_letter || null,
        birth_year: data.birth_year || null,
        death_year: data.death_year || null,
        place_of_birth: data.place_of_birth || null,
        place_of_death: data.place_of_death || null,
        nationality: data.nationality || null,
        biography: data.biography || null,
        email: data.email || null,
        image_url
      });

      if (error) throw error;

      toast.success("Artist created successfully");
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      reset();
      onSuccess();
    } catch (error) {
      console.error('Error creating artist:', error);
      toast.error("Failed to create artist: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    handleSubmit: handleFormSubmit(onSubmit),
    onSubmit, // Exporting onSubmit directly if needed elsewhere, though handleSubmit is typical for form element
    isLoading,
    errors,
    resetForm: reset,
  };
};

