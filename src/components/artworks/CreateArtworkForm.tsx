import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage, } from "@/components/ui/form";
import { ImageUploader } from "./ImageUploader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dispatch, SetStateAction } from "react";
import { BasicInformationFields } from "./form/BasicInformationFields";
import { PricingFields } from "./form/PricingFields";
import { EditionFields } from "./form/EditionFields";
import { ArtworkFormData } from "./form/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <BasicInformationFields form={form} artists={artists} />
        
        <FormField
          control={form.control}
          name="medium_type"
          rules={{ required: "Medium type is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medium Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select medium type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {['Painting', 'Sculpture', 'Photography', 'Work on Paper', 'Installation', 'Video', 'Textile Arts', 'Book'].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="materials"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Materials</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Oil on canvas" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="classification"
          rules={{ required: "Classification is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Classification</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select classification" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {['Unique', 'Limited Edition', 'Open Edition', 'Unknown Edition'].map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <PricingFields form={form} />
        <EditionFields form={form} show={classification !== 'Unique'} />

        <FormField
          control={form.control}
          name="dimensions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dimensions</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., 100 x 80 cm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {locations?.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="on hold">On Hold</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
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
