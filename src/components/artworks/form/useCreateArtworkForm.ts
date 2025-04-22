
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ArtworkFormData } from "./types";
import { Artwork } from "@/hooks/use-artworks";

export type UseCreateArtworkFormProps = {
  setOpen: (open: boolean) => void;
  initialData?: Artwork;
};

export function useCreateArtworkForm({ setOpen, initialData }: UseCreateArtworkFormProps) {
  const { toast } = useToast();
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  // Add QueryClient access
  const queryClient = useQueryClient();

  // Safely cast the currency and signature_type to the correct type for the form default values
  const currencyValue = 
    initialData?.currency && ["USD", "GBP", "EUR", "CHF"].includes(initialData.currency)
      ? initialData.currency as ArtworkFormData["currency"]
      : "USD";

  const signatureTypeValue = 
    initialData?.signature_type && 
    [
      "not signed",
      "hand-signed by artist",
      "signed on plate",
      "stamped by artist's estate",
      "sticker label",
      "other"
    ].includes(initialData.signature_type)
      ? initialData.signature_type as ArtworkFormData["signature_type"]
      : "not signed";

  // Cast medium_type to the correct ArtworkFormData type
  const mediumTypeValue = 
    initialData?.medium_type && 
    [
      "Painting",
      "Sculpture", 
      "Photography", 
      "Work on Paper", 
      "Installation", 
      "Video", 
      "Textile Arts", 
      "Book"
    ].includes(initialData.medium_type)
      ? initialData.medium_type as ArtworkFormData["medium_type"]
      : "Painting";

  // Cast classification to the correct ArtworkFormData type
  const classificationValue = 
    initialData?.classification &&
    [
      "Unique", 
      "Limited Edition", 
      "Open Edition", 
      "Unknown Edition"
    ].includes(initialData.classification)
      ? initialData.classification as ArtworkFormData["classification"]
      : "Unique";

  const form = useForm<ArtworkFormData>({
    defaultValues: {
      // ... Basic fields
      title: initialData?.title || "",
      artist_id: initialData?.artist_id || "",
      year: initialData?.year || undefined,
      medium_type: mediumTypeValue,
      materials: initialData?.materials || "",
      classification: classificationValue,
      edition_size: initialData?.edition_size || undefined,
      dimensions: initialData?.dimensions || "",
      price: initialData?.price || undefined,
      currency: currencyValue,
      inventory_quantity: initialData?.inventory_quantity || undefined,
      available_works: initialData?.available_works || undefined,
      artist_proofs: initialData?.artist_proofs || undefined,
      height: initialData?.height || undefined,
      width: initialData?.width || undefined,
      depth: initialData?.depth || undefined,
      // NEW FIELDS for framing / crate / weight
      is_framed: initialData?.is_framed ?? false,
      frame_height: initialData?.frame_height || undefined,
      frame_width: initialData?.frame_width || undefined,
      frame_depth: initialData?.frame_depth || undefined,
      weight: initialData?.weight || undefined,
      has_crate: initialData?.has_crate ?? false,
      crate_height: initialData?.crate_height || undefined,
      crate_width: initialData?.crate_width || undefined,
      crate_depth: initialData?.crate_depth || undefined,
      // Rest fields
      location_id: initialData?.location_id || "",
      status: initialData?.status || 'available',
      image_url: initialData?.image_url || "",
      condition: initialData?.condition || "",
      signature_type: signatureTypeValue,
      signature_details: initialData?.signature_details || "",
      provenance: initialData?.provenance || "",
      story: initialData?.story || "",
      exhibition_history: initialData?.exhibition_history || ""
    }
  });

  const classification = form.watch('classification');

  const { data: artists } = useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('id, full_name');
      if (error) throw error;
      return data;
    }
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name');
      if (error) throw error;
      return data;
    }
  });

  const handleImagesUploaded = (urls: string[]) => {
    if (urls.length > 0) {
      form.setValue("image_url", urls[0]);
      setUploadedImageUrls(urls);
    }
  };

  const onSubmit = async (data: ArtworkFormData) => {
    try {
      const dimensions = [
        data.height ? `${data.height}cm H` : '',
        data.width ? `${data.width}cm W` : '',
        data.depth ? `${data.depth}cm D` : ''
      ].filter(Boolean).join(' x ');

      // Compose formattedData to include new fields!
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
        available_works: data.available_works ? Number(data.available_works) : null,
        artist_proofs: data.artist_proofs ? Number(data.artist_proofs) : null,
        // New framing/crate/weight fields
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

      if (initialData) {
        // Update existing artwork
        const { error } = await supabase
          .from('artworks')
          .update(formattedData)
          .eq('id', initialData.id)
          .select();
        if (error) throw error;
      } else {
        // Create new artwork
        const { error } = await supabase
          .from('artworks')
          .insert([formattedData])
          .select();
        if (error) throw error;
      }

      // Add uploaded images logic
      if (uploadedImageUrls.length > 0) {
        let artworkId: string | undefined = initialData?.id;

        if (!artworkId) {
          // Get the new artwork ID after creation
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

      // Invalidate and refetch artworks list after successful change
      await queryClient.invalidateQueries({ queryKey: ['artworks'] });

      toast({
        title: "Success",
        description: initialData 
          ? "Artwork has been updated successfully"
          : "Artwork has been created successfully",
      });

      setOpen(false);
      form.reset();
      setUploadedImageUrls([]);
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Error",
        description: initialData
          ? "There was an error updating the artwork"
          : "There was an error creating the artwork",
        variant: "destructive",
      });
    }
  };

  return {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    handleImagesUploaded,
    uploadedImageUrls,
    initialData
  };
}

