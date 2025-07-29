import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useArtists } from "@/hooks/useArtists";
import { useLocations } from "@/hooks/use-locations";
import { useSafeAsync } from "@/hooks/use-safe-async";
import { useQueryClient } from "@tanstack/react-query";
import { useUserRoles } from "@/hooks/use-user-roles";
import { ArtworkFormData } from "./types";
import { useAutosave } from "@/hooks/use-autosave";
import { getArtworkInitialValues } from "./getArtworkInitialValues";

export interface UseCreateArtworkFormProps {
  setOpen: (open: boolean) => void;
  initialData?: any;
  preventFreeze?: boolean;
  onSuccessCallback?: () => void;
  enableAutosave?: boolean;
}

export function useCreateArtworkForm({ 
  setOpen, 
  initialData, 
  preventFreeze = false, 
  onSuccessCallback,
  enableAutosave = false
}: UseCreateArtworkFormProps) {
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { data: artists } = useArtists();
  const { data: locations } = useLocations();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const { execute, isLoading: isSaving } = useSafeAsync();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const userRoles = useUserRoles(user);
  const isAdmin = userRoles.isAdmin || false;
  const currentUserArtist = null; // Simplified for now

  const form = useForm<ArtworkFormData>({
    defaultValues: getArtworkInitialValues(initialData, isAdmin, currentUserArtist),
  });

  const classification = form.watch('classification');

  const handleImagesUploaded = (urls: string[]) => {
    setUploadedImageUrls(prev => [...prev, ...urls]);
  };

  const handleArtsyImageSelected = (urls: string[]) => {
    setUploadedImageUrls(prev => [...prev, ...urls]);
  };

  const resetUploaded = () => {
    setUploadedImageUrls([]);
  };

  // Separate function for performing the save operation
  const performSave = async (submissionData: ArtworkFormData) => {
    console.log("performSave called with:", submissionData);
    console.log("initialData:", initialData);
    
    // Ensure artist_id is correctly set if current user is an artist and not admin
    if (!isAdmin && currentUserArtist && !initialData) {
      submissionData.artist_id = currentUserArtist.id;
    } else if (!isAdmin && currentUserArtist && initialData && initialData.artist_id !== currentUserArtist.id) {
      throw new Error("You can only edit your own artworks.");
    }

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
      console.log("Updating existing artwork with ID:", initialData.id);
      console.log("Formatted update data:", formattedData);
      
      const { data: updatedData, error } = await supabase
        .from('artworks')
        .update(formattedData as any)
        .eq('id', initialData.id)
        .select();
      
      console.log("Update result:", { data: updatedData, error });
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
        image_url: url,
        is_primary: index === 0,
        display_order: index,
        processed: false,
        thumbnail_url: null,
        medium_url: null,
      }));

      const { data: insertedImages, error: imageError } = await supabase
        .from('artwork_images')
        .insert(imagesToInsert)
        .select();

      if (imageError) throw imageError;

      // Note: Image processing with Cloudinary would happen here
      // For now, we're just inserting the image records
    }

    return { success: true };
  };

  // Autosave implementation
  const handleAutosave = async (data: ArtworkFormData) => {
    if (!initialData || !enableAutosave) return;
    
    setAutosaveStatus('saving');
    try {
      await performSave(data);
      setAutosaveStatus('saved');
      
      // Invalidate queries to update the UI
      queryClient.invalidateQueries({ queryKey: ['artworks'] });
      queryClient.invalidateQueries({ queryKey: ['artwork', initialData?.id] });
      
      setTimeout(() => setAutosaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Autosave error:', error);
      setAutosaveStatus('error');
      setTimeout(() => setAutosaveStatus('idle'), 3000);
    }
  };

  // Set up autosave
  useAutosave({
    form,
    onSave: handleAutosave,
    delay: 2000,
    enabled: enableAutosave && !!initialData
  });

  // Manual submit function (for new artworks and manual saves)
  const onSubmit = async (submissionData: ArtworkFormData) => {
    execute(
      async () => {
        await performSave(submissionData);
        return { success: true };
      },
      {
        successMessage: initialData 
          ? "Artwork has been updated successfully"
          : "Artwork has been created successfully",
        onSuccess: () => {
          resetUploaded();
          
          // Only reset form for new artworks, not updates
          if (!initialData) {
            form.reset(getArtworkInitialValues(undefined, isAdmin, currentUserArtist)); 
          }
          
          // Immediately invalidate queries to update the UI
          queryClient.invalidateQueries({ queryKey: ['artworks'] });
          queryClient.invalidateQueries({ queryKey: ['artwork-images'] });
          queryClient.invalidateQueries({ queryKey: ['artwork', initialData?.id] });
          
          if (!enableAutosave) {
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
          }
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
    uploadedImageUrls,
    handleImagesUploaded,
    handleArtsyImageSelected,
    resetUploaded,
    isSaving,
    isAdmin,
    currentUserArtist,
    autosaveStatus
  };
}