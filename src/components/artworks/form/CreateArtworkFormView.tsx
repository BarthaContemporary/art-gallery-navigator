
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
import { VideoUploadFields } from "./VideoUploadFields";
import { LocalImageUploader } from "../LocalImageUploader";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { TargetedImageSearch } from "./TargetedImageSearch";
import { ArtworkFormData } from "./types";
import { Artwork } from "@/hooks/use-artworks";

interface CreateArtworkFormViewProps {
  form: UseFormReturn<ArtworkFormData>;
  classification: string;
  artists: any[];
  locations: any[];
  handleImagesUploaded: (urls: string[]) => void;
  handleArtsyImageSelected: (urls: string[]) => void;
  initialData?: Artwork;
  onSubmit: (data: ArtworkFormData) => void;
  isAdmin: boolean;
  currentUserArtist: any;
  hideSubmitButton?: boolean;
  formId?: string;
  isSaving?: boolean;
  scrollToFirstError?: () => void;
  artworkId?: string; // For created artworks
}

export function CreateArtworkFormView({
  form,
  classification,
  artists,
  locations,
  handleImagesUploaded,
  handleArtsyImageSelected,
  initialData,
  onSubmit,
  isAdmin,
  currentUserArtist,
  hideSubmitButton = false,
  formId,
  isSaving = false,
  scrollToFirstError,
  artworkId,
}: CreateArtworkFormViewProps) {

  const handleInvalidSubmit = () => {
    if (scrollToFirstError) {
      setTimeout(() => {
        scrollToFirstError();
      }, 100);
    }
  };

  const handleFormSubmit = (data: ArtworkFormData) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form 
        id={formId}
        onSubmit={form.handleSubmit(handleFormSubmit, handleInvalidSubmit)}
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
        
        <ProvenanceStoryFields form={form} artists={artists} initialData={initialData} />
        
        {!initialData && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Upload Images</label>
                <TargetedImageSearch
                  onImageSelected={handleArtsyImageSelected}
                  defaultArtist={form.getValues('artist_id') ? artists?.find(a => a.id === form.getValues('artist_id'))?.full_name : ''}
                  defaultTitle={form.getValues('title')}
                  defaultYear={form.getValues('year')}
                />
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Upload high-quality images of your artwork or search Artsy.net for similar pieces. The first image will be set as primary.
              </p>
              {artworkId ? (
                <LocalImageUploader 
                  artworkId={artworkId}
                  onUploadComplete={() => {
                    // Images uploaded successfully
                  }}
                />
              ) : (
                <div className="p-4 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                  <p className="text-sm">Images can be uploaded after creating the artwork</p>
                </div>
              )}
            </div>
            
            <VideoUploadFields />

            <div className="space-y-2">
              <label className="text-sm font-medium">Upload Documents</label>
              <p className="text-xs text-muted-foreground mb-4">
                Upload documents related to this artwork (certificates, invoices, etc.)
              </p>
              <UploadDocumentDialog />
            </div>
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
