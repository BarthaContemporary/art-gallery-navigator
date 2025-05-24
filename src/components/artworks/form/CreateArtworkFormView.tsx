
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { MultipleImageUploader } from "../MultipleImageUploader";
import { BasicInformationFields } from "./BasicInformationFields";
import { MaterialsFields } from "./MaterialsFields";
import { ClassificationFields } from "./ClassificationFields";
import { EditionFields } from "./EditionFields";
import { DimensionsFields } from "./DimensionsFields";
import { PricingFields } from "./PricingFields";
import { LocationStatusFields } from "./LocationStatusFields";
import { ConditionSignatureFields } from "./ConditionSignatureFields";
import { ProvenanceStoryFields } from "./ProvenanceStoryFields";
import { FramingCrateFields } from "./FramingCrateFields";
import { ArtworkFormData } from "./types";
import { UseFormReturn } from "react-hook-form";
import { Artist } from "@/hooks/useArtists"; // Import the standardized Artist type

interface CreateArtworkFormViewProps {
  form: UseFormReturn<ArtworkFormData>;
  classification: string;
  artists: Artist[] | undefined; // Use the standardized Artist type
  locations: { id: string; name: string; }[] | undefined;
  handleImagesUploaded: (urls: string[]) => void;
  initialData?: any;
  onSubmit: (data: ArtworkFormData) => Promise<void>;
}

export function CreateArtworkFormView({
  form,
  classification,
  artists,
  locations,
  handleImagesUploaded,
  initialData,
  onSubmit,
}: CreateArtworkFormViewProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <BasicInformationFields form={form} artists={artists} />
        <MaterialsFields form={form} />
        <ClassificationFields form={form} />
        <EditionFields form={form} show={classification !== 'Unique'} />
        <DimensionsFields form={form} />
        {/* Moved price, then add new fields here */}
        <PricingFields form={form} />
        <FramingCrateFields form={form} />
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

        {/* Move Location and Status to the very end */}
        <LocationStatusFields form={form} locations={locations} />

        <Button type="submit" className="w-full">
          {initialData ? "Update Artwork" : "Create Artwork"}
        </Button>
      </form>
    </Form>
  );
}

