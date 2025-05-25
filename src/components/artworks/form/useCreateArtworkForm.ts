
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
import { useAuth } from "@/hooks/use-auth"; // Import useAuth
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist"; // Import useCurrentUserArtist

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
  const { isAdmin } = useAuth(); // Get admin status
  const currentUserArtist = useCurrentUserArtist(); // Get current artist info

  const form = useForm<ArtworkFormData>({
    defaultValues: getArtworkInitialValues(initialData, isAdmin, currentUserArtist),
  });

  const classification = form.watch('classification');

  const { data: artists } = useArtists(); // Still needed for admin user or if artist list is shown for info
  const { data: locations } = useLocations();

  const {
    uploadedImageUrls,
    handleImagesUploaded,
    resetUploaded
  } = useImageUpload(form);

  const onSubmit = async (data: ArtworkFormData) => {
    // Ensure artist_id is correctly set if current user is an artist and not admin
    let submissionData = { ...data };
    if (!isAdmin && currentUserArtist && !initialData) { // For new artwork by non-admin artist
      submissionData.artist_id = currentUserArtist.id;
    } else if (!isAdmin && currentUserArtist && initialData && initialData.artist_id !== currentUserArtist.id) {
        // This case should ideally be prevented by RLS, but as a safeguard:
        toast({
            title: "Permission Denied",
            description: "You can only edit your own artworks.",
            variant: "destructive",
        });
        return;
    }


    execute(
      async () => {
        const dimensions = [
          submissionData.height ? `${submissionData.height}cm H` : '',
          submissionData.width ? `${submissionData.width}cm W` : '',
          submissionData.depth ? `${submissionData.depth}cm D` : ''
        ].filter(Boolean).join(' x ');

        const formattedData = {
          ...submissionData,
          dimensions: dimensions || null,
          price: submissionData.price ? Number(submissionData.price) : null,
          year: submissionData.year ? Number(submissionData.year) : null,
          height: submissionData.height ? Number(submissionData.height) : null,
          width: submissionData.width ? Number(submissionData.width) : null,
          depth: submissionData.depth ? Number(submissionData.depth) : null,
          edition_size: submissionData.edition_size ? Number(submissionData.edition_size) : null,
          inventory_quantity: submissionData.inventory_quantity ? Number(submissionData.inventory_quantity) : null,
          available_works: submissionData.available_works || null,
          artist_proofs: submissionData.artist_proofs ? Number(submissionData.artist_proofs) : null,
          is_framed: !!submissionData.is_framed,
          frame_height: submissionData.frame_height ? Number(submissionData.frame_height) : null,
          frame_width: submissionData.frame_width ? Number(submissionData.frame_width) : null,
          frame_depth: submissionData.frame_depth ? Number(submissionData.frame_depth) : null,
          weight: submissionData.weight ? Number(submissionData.weight) : null,
          has_crate: !!submissionData.has_crate,
          crate_height: submissionData.crate_height ? Number(submissionData.crate_height) : null,
          crate_width: submissionData.crate_width ? Number(submissionData.crate_width) : null,
          crate_depth: submissionData.crate_depth ? Number(submissionData.crate_depth) : null,
        };

        let artworkId: string;
        if (initialData) {
          // RLS policies on 'artworks' table will ensure an artist can only update their own.
          const { error } = await supabase
            .from('artworks')
            .update(formattedData as any)
            .eq('id', initialData.id)
            .select();
          
          if (error) throw error;
          artworkId = initialData.id;
        } else {
          // RLS policies on 'artworks' table will ensure an artist can only create for themselves.
          const { data: newArtwork, error } = await supabase
            .from('artworks')
            .insert([formattedData as any])
            .select()
            .single();
          
          if (error) throw error;
          if (!newArtwork) throw new Error("Artwork creation failed.");
          artworkId = newArtwork.id;
        }

        if (uploadedImageUrls.length > 0) {
          const imagesToInsert = uploadedImageUrls.map((url, index) => ({
            artwork_id: artworkId,
            image_url: url,
            is_primary: index === 0, // TODO: This logic needs to be smarter if editing and adding new images
            display_order: index, // TODO: This needs to be smarter for existing images
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
          // Reset form with potentially new defaults if user role changed or for next creation
          form.reset(getArtworkInitialValues(undefined, isAdmin, currentUserArtist)); 
          
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
    artists, // Full list of artists for admins or display purposes
    locations,
    onSubmit,
    handleImagesUploaded,
    uploadedImageUrls,
    initialData,
    isSaving,
    isAdmin, // Pass admin status down
    currentUserArtist // Pass current artist info down
  };
}
