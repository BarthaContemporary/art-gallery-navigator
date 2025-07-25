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
import { useEnhancedImageProcessing } from "@/hooks/use-enhanced-image-processing";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserArtist } from "@/hooks/useCurrentUserArtist";

export type UseCreateArtworkFormProps = {
  setOpen: (open: boolean) => void;
  initialData?: Artwork;
  preventFreeze?: boolean;
  onSuccessCallback?: () => void;
};

export function useCreateArtworkForm({ 
  setOpen, 
  initialData, 
  preventFreeze = false,
  onSuccessCallback 
}: UseCreateArtworkFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { execute, isLoading: isSaving } = useSafeAsync();
  const { processImageWithCloudinary } = useEnhancedImageProcessing();
  const { isAdmin } = useAuth();
  const currentUserArtist = useCurrentUserArtist();

  const form = useForm<ArtworkFormData>({
    defaultValues: getArtworkInitialValues(initialData, isAdmin, currentUserArtist),
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
    // Ensure artist_id is correctly set if current user is an artist and not admin
    let submissionData = { ...data };
    if (!isAdmin && currentUserArtist && !initialData) {
      submissionData.artist_id = currentUserArtist.id;
    } else if (!isAdmin && currentUserArtist && initialData && initialData.artist_id !== currentUserArtist.id) {
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
          if (!newArtwork) throw new Error("Artwork creation failed.");
          artworkId = newArtwork.id;
        }

        if (uploadedImageUrls.length > 0) {
          const imagesToInsert = uploadedImageUrls.map((url, index) => ({
            artwork_id: artworkId,
            image_url: url, // This is the original Supabase URL
            is_primary: index === 0,
            display_order: index,
            processed: false, // Will be set to true by Cloudinary function
            // Ensure thumbnail_url and medium_url are nullable or handle their initial state
            thumbnail_url: null,
            medium_url: null,
          }));

          const { data: insertedImages, error: imageError } = await supabase
            .from('artwork_images')
            .insert(imagesToInsert)
            .select();

          if (imageError) throw imageError;

          // Process images with Cloudinary
          if (insertedImages) {
            for (const image of insertedImages) {
              // image.image_url here is the original Supabase URL
              await processImageWithCloudinary(image.image_url, image.id);
            }
          }
        }

        return { success: true };
      },
      {
        successMessage: initialData 
          ? "Artwork has been updated successfully"
          : "Artwork has been created successfully",
        onSuccess: () => {
          resetUploaded();
          form.reset(getArtworkInitialValues(undefined, isAdmin, currentUserArtist)); 
          
          // Immediately invalidate queries to update the UI
          queryClient.invalidateQueries({ queryKey: ['artworks'] });
          queryClient.invalidateQueries({ queryKey: ['artwork-images'] });
          queryClient.invalidateQueries({ queryKey: ['artwork', initialData?.id] });
          
          const safeTimeout = preventFreeze ? 500 : 250;
          setTimeout(() => {
            if (onSuccessCallback) {
              onSuccessCallback();
            } else {
              requestAnimationFrame(() => {
                setOpen(false);
              });
            }
          }, safeTimeout);
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
    isSaving,
    isAdmin,
    currentUserArtist
  };
}
