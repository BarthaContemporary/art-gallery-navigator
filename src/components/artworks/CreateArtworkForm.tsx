import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { MultipleImageUploader } from "./MultipleImageUploader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dispatch, SetStateAction } from "react";
import { BasicInformationFields } from "./form/BasicInformationFields";
import { MaterialsFields } from "./form/MaterialsFields";
import { ClassificationFields } from "./form/ClassificationFields";
import { PricingFields } from "./form/PricingFields";
import { EditionFields } from "./form/EditionFields";
import { DimensionsFields } from "./form/DimensionsFields";
import { LocationStatusFields } from "./form/LocationStatusFields";
import { ConditionSignatureFields } from "./form/ConditionSignatureFields";
import { ProvenanceStoryFields } from "./form/ProvenanceStoryFields";
import { ArtworkFormData } from "./form/types";

export function CreateArtworkForm({
  setOpen,
}: {
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const { toast } = useToast();
  const form = useForm<ArtworkFormData>({
    defaultValues: {
      currency: 'USD',
      status: 'available',
      signature_type: 'not signed'
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

  const handleImagesUploaded = async (urls: string[]) => {
    if (urls.length > 0) {
      form.setValue("image_url", urls[0]);
      
      const artworkId = form.getValues("id");
      if (artworkId) {
        try {
          const images = urls.map((url, index) => ({
            artwork_id: artworkId,
            image_url: url,
            is_primary: index === 0,
            display_order: index
          }));

          const { error } = await supabase
            .from('artwork_images')
            .insert(images);

          if (error) throw error;
        } catch (error) {
          console.error("Error saving additional images:", error);
          toast({
            title: "Error",
            description: "Failed to save additional images",
            variant: "destructive",
          });
        }
      }
    }
  };

  const onSubmit = async (data: ArtworkFormData) => {
    try {
      const dimensions = [
        data.height ? `${data.height}cm H` : '',
        data.width ? `${data.width}cm W` : '',
        data.depth ? `${data.depth}cm D` : ''
      ].filter(Boolean).join(' x ');

      const { data: artwork, error } = await supabase
        .from('artworks')
        .insert([{
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
          artist_proofs: data.artist_proofs ? Number(data.artist_proofs) : null
        }])
        .select()
        .single();
        
      if (error) throw error;

      if (artwork) {
        const imageUrl = form.getValues("image_url");
        if (imageUrl) {
          const { error: imageError } = await supabase
            .from('artwork_images')
            .insert([{
              artwork_id: artwork.id,
              image_url: imageUrl,
              is_primary: true,
              display_order: 0
            }]);
            
          if (imageError) throw imageError;
        }
      }
      
      toast({
        title: "Success",
        description: "Artwork has been created successfully",
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        title: "Error",
        description: "There was an error creating the artwork",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <BasicInformationFields form={form} artists={artists} />
        <MaterialsFields form={form} />
        <ClassificationFields form={form} />
        <PricingFields form={form} />
        <EditionFields form={form} show={classification !== 'Unique'} />
        <DimensionsFields form={form} />
        <LocationStatusFields form={form} locations={locations} />
        <ConditionSignatureFields form={form} />
        <ProvenanceStoryFields form={form} />
        
        <FormField
          control={form.control}
          name="image_url"
          render={() => (
            <FormItem>
              <FormLabel>Images</FormLabel>
              <FormControl>
                <MultipleImageUploader onImagesUploaded={handleImagesUploaded} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          Create Artwork
        </Button>
      </form>
    </Form>
  );
}
