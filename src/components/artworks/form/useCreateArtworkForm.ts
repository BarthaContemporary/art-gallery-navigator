
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArtworkFormData } from "./types";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "./useArtists";
import { useLocations } from "./useLocations";
import { useImageUpload } from "./useImageUpload";
import { getArtworkInitialValues } from "./getArtworkInitialValues";
import { useSafeAsync } from "@/hooks/use-safe-async";

export type UseCreateArtworkFormProps = {
  setOpen: (open: boolean) => void;
  initialData?: Artwork;
  preventFreeze?: boolean;
};

export function useCreateArtworkForm({ setOpen, initialData, preventFreeze = false }: UseCreateArtworkFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute, isLoading: isSaving } = useSafeAsync();

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
    // Use our safe async execution pattern
    execute(
      async () => {
        const dimensions = [
          data.height ? `${data.height}cm H` : '',
          data.width ? `${data.width}cm W` : '',
          data.depth ? `${data.depth}cm D` : ''
        ].filter(Boolean).join(' x ');

        // Cast the data to the expected types before sending to Supabase
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
          available_works: data.available_works || null, // Keep as string
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

        // Database operations - update or create artwork
        if (initialData) {
          // Update artwork
          const { error } = await supabase
            .from('artworks')
            .update(formattedData as any)
            .eq('id', initialData.id)
            .select();
          
          if (error) throw error;
        } else {
          // Create new artwork
          const { error } = await supabase
            .from('artworks')
            .insert([formattedData as any])
            .select();
          
          if (error) throw error;
        }

        // Handle image uploads if any
        if (uploadedImageUrls.length > 0) {
          let artworkId: string | undefined = initialData?.id;

          if (!artworkId) {
            const { data: artworks, error: fetchError } = await supabase
              .from('artworks')
              .select('id')
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (fetchError) throw fetchError;
            artworkId = artworks && artworks.length > 0 ? artworks[0].id : undefined;
          }

          if (artworkId) {
            const imagesToInsert = uploadedImageUrls.map((url, index) => ({
              artwork_id: artworkId,
              image_url: url,
              is_primary: index === 0,
              display_order: index
            }));

            const { error: imageError } = await supabase
              .from('artwork_images')
              .insert(imagesToInsert);

            if (imageError) throw imageError;
          }
        }

        return { success: true };
      },
      {
        successMessage: initialData 
          ? "Artwork has been updated successfully"
          : "Artwork has been created successfully",
        onSuccess: () => {
          // Reset form state first
          resetUploaded();
          form.reset();
          
          // Set a minimum timeout for closing the dialog
          // Let UI settle before invalidating queries
          setTimeout(() => {
            // First invalidate queries
            queryClient.invalidateQueries({ queryKey: ['artworks'] });
            
            // Then wait a bit longer before closing the dialog
            const safeTimeout = preventFreeze ? 500 : 250;
            setTimeout(() => {
              // Use requestAnimationFrame for smoother transitions
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
