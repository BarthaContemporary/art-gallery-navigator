import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArtworkFormData } from "./types";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { useLocations } from "./useLocations";
import { useImageUpload } from "./useImageUpload";
import { getArtworkInitialValues } from "./getArtworkInitialValues";
import { useSafeAsync } from "@/hooks/use-safe-async";
import { useImageProcessing } from "@/hooks/use-image-processing";

export type UseCreateArtworkFormProps = {
  setOpen: (open: boolean) => void;
  initialData?: Artwork;
  preventFreeze?: boolean;
};

export function useCreateArtworkForm({ setOpen, initialData, preventFreeze = false }: UseCreateArtworkFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute, isLoading: isSaving } = useSafeAsync();
  const { processImage } = useImageProcessing();

  const form = useForm<ArtworkFormData>({
    defaultValues: getArtworkInitialValues(initialData),
  });

  const classification = form.watch('classification');

  const { data: artists } = useArtists();
  const { data: locations } = useLocations();

  const {
    uploadedImageUrls,
    handleImagesUploaded,
    resetUploaded
  } = useImageUpload(form);

  const onSubmit = async (data: ArtworkFormData) => {
    execute(
      async () => {
        const dimensions = [
          data.height ? `${data.height}cm H` : '',
          data.width ? `${data.width}cm W` : '',
          data.depth ? `${data.depth}cm D` : ''
        ].filter(Boolean).join(' x ');

        const formattedData = {
          ...data,
          dimensions: dimensions || null,
          price: data.price ? Number(data.price) : null,
          year: data.year ? Number(data.year) : null,
          height: data.height ? Number(data.height) : null,
          width: data.width ? Number(data.width) : null,
          depth: data.depth ? Number(data.depth) : null,
          edition_size: data.edition_size ? Number(data.edition_size) : null,
          inventory_quantity: data.inventory_quantity ? Number(data.inventory_quantity) : null,
          available_works: data.available_works || null,
          artist_proofs: data.artist_proofs ? Number(data.artist_proofs) : null,
          is_framed: !!data.is_framed,
          frame_height: data.frame_height ? Number(data.frame_height) : null,
          frame_width: data.frame_width ? Number(data.frame_width) : null,
          frame_depth: data.frame_depth ? Number(data.frame_depth) : null,
          weight: data.weight ? Number(data.weight) : null,
          has_crate: !!data.has_crate,
          crate_height: data.crate_height ? Number(data.crate_height) : null,
          crate_width: data.crate_width ? Number(data.crate_width) : null,
          crate_depth: data.crate_depth ? Number(data.crate_depth) : null,
        };

        let artworkId: string;
        if (initialData) {
          const { error } = await supabase
            .from('artworks')
            .update(formattedData as any)
            .eq('id', initialData.id)
            .select();
          
          if (error) throw error;
          artworkId = initialData.id;
        } else {
          const { data: newArtwork, error } = await supabase
            .from('artworks')
            .insert([formattedData as any])
            .select()
            .single();
          
          if (error) throw error;
          artworkId = newArtwork.id;
        }

        if (uploadedImageUrls.length > 0) {
          const imagesToInsert = uploadedImageUrls.map((url, index) => ({
            artwork_id: artworkId,
            image_url: url,
            is_primary: index === 0,
            display_order: index,
            processed: false
          }));

          const { data: insertedImages, error: imageError } = await supabase
            .from('artwork_images')
            .insert(imagesToInsert)
            .select();

          if (imageError) throw imageError;

          insertedImages?.forEach(image => {
            processImage(image.image_url, image.id);
          });
        }

        return { success: true };
      },
      {
        successMessage: initialData 
          ? "Artwork has been updated successfully"
          : "Artwork has been created successfully",
        onSuccess: () => {
          resetUploaded();
          form.reset();
          
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['artworks'] });
            const safeTimeout = preventFreeze ? 500 : 250;
            setTimeout(() => {
              requestAnimationFrame(() => {
                setOpen(false);
              });
            }, safeTimeout);
          }, 100);
        },
        errorMessage: initialData
          ? "There was an error updating the artwork"
          : "There was an error creating the artwork"
      }
    );
  };

  return {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    handleImagesUploaded,
    uploadedImageUrls,
    initialData,
    isSaving
  };
}
