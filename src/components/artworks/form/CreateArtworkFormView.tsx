import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { BasicInformationFields } from "./BasicInformationFields";
import { ClassificationFields } from "./ClassificationFields";
import { MaterialsFields } from "./MaterialsFields";
import { DimensionsFields } from "./DimensionsFields";
import { LocationStatusFields } from "./LocationStatusFields";
import { PricingFields } from "./PricingFields";
import { EditionFields } from "./EditionFields";
import { ConditionSignatureFields } from "./ConditionSignatureFields";
import { FramingCrateFields } from "./FramingCrateFields";
import { ProvenanceStoryFields } from "./ProvenanceStoryFields";
import { MultipleImageUploader } from "../MultipleImageUploader";
import { ArtworkFormData } from "./types";
import { Artwork } from "@/hooks/use-artworks";

interface CreateArtworkFormViewProps {
  form: UseFormReturn<ArtworkFormData>;
  classification: string;
  artists: any[];
  locations: any[];
  handleImagesUploaded: (urls: string[]) => void;
  initialData?: Artwork;
  onSubmit: (data: ArtworkFormData) => void;
  isAdmin: boolean;
  currentUserArtist: any;
  hideSubmitButton?: boolean;
  formId?: string;
  isSaving?: boolean;
  scrollToFirstError?: () => void; // New prop
}

export function CreateArtworkFormView({
  form,
  classification,
  artists,
  locations,
  handleImagesUploaded,
  initialData,
  onSubmit,
  isAdmin,
  currentUserArtist,
  hideSubmitButton = false,
  formId,
  isSaving = false,
  scrollToFirstError, // Destructure new prop
}: CreateArtworkFormViewProps) {

  const handleInvalidSubmit = () => {
    if (scrollToFirstError) {
      // Timeout to allow DOM to update with error messages before scrolling
      setTimeout(() => {
        scrollToFirstError();
      }, 100);
    }
  };

  return (
    <Form {...form}>
      <form 
        id={formId}
        onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} // Pass onInvalid handler
        className="space-y-6"
      >
        <BasicInformationFields 
          form={form} 
          artists={artists}
          isAdmin={isAdmin}
          currentUserArtistId={currentUserArtist?.id}
        />
        
        <ClassificationFields 
          form={form} 
        />
        
        <MaterialsFields form={form} />
        
        <DimensionsFields form={form} />
        
        <LocationStatusFields 
          form={form} 
          locations={locations}
        />
        
        <PricingFields form={form} />
        
        <EditionFields 
          form={form} 
          show={classification === 'Limited Edition' || classification === 'Open Edition'}
        />
        
        <ConditionSignatureFields form={form} />
        
        <FramingCrateFields form={form} />
        
        <ProvenanceStoryFields form={form} />
        
        {!initialData && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Upload Images</label>
            <MultipleImageUploader onImagesUploaded={handleImagesUploaded} />
          </div>
        )}
        
        {!hideSubmitButton && (
          <Button 
            type="submit" 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? "Update Artwork" : "Create Artwork"}
          </Button>
        )}
      </form>
    </Form>
  );
}
