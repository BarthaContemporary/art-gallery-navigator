
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { MultipleImageUploader } from "../MultipleImageUploader";
import { BasicInformationFields } from "./BasicInformationFields";
import { MaterialsFields } from "./MaterialsFields";
import { ClassificationFields } from "./ClassificationFields";
import { PricingFields } from "./PricingFields";
import { EditionFields } from "./EditionFields";
import { DimensionsFields } from "./DimensionsFields";
import { LocationStatusFields } from "./LocationStatusFields";
import { ConditionSignatureFields } from "./ConditionSignatureFields";
import { ProvenanceStoryFields } from "./ProvenanceStoryFields";
import { ArtworkFormData } from "./types";

interface CreateArtworkFormViewProps {
  form: ReturnType<typeof import("react-hook-form")["useForm"]>;
  classification: string;
  artists: { id: string; full_name: string; }[] | undefined;
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
          {initialData ? "Update Artwork" : "Create Artwork"}
        </Button>
      </form>
    </Form>
  );
}
