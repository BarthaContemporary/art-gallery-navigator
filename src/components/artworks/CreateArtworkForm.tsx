import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { ImageUploader } from "./ImageUploader";
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
  const form = useForm<ArtworkFormData>();
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

  const handleImageUploaded = (url: string) => {
    form.setValue("image_url", url);
  };

  const onSubmit = async (data: ArtworkFormData) => {
    try {
      const { error } = await supabase
        .from('artworks')
        .insert([{
          ...data,
          price: Number(data.price),
          year: Number(data.year),
          height: data.height ? Number(data.height) : null,
          width: data.width ? Number(data.width) : null,
          depth: data.depth ? Number(data.depth) : null,
          edition_size: data.edition_size ? Number(data.edition_size) : null
        }]);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Artwork has been created successfully",
      });
      setOpen(false);
      form.reset();
    } catch (error) {
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
              <FormLabel>Image</FormLabel>
              <FormControl>
                <ImageUploader onImageUploaded={handleImageUploaded} />
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
