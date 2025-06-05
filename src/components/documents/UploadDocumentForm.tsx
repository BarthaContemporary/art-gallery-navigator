
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Upload } from "lucide-react";
import { FileUploadField } from "./form/FileUploadField";
import { DocumentTypeField } from "./form/DocumentTypeField";
import { ArtworkField } from "./form/ArtworkField";
import { CollectionField } from "./form/CollectionField";
import { ArtistField } from "./ArtistField";
import { DescriptionField } from "./form/DescriptionField";
import { useWatch, UseFormReturn } from "react-hook-form";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { UploadFormData } from "./upload-document-schema";

interface UploadDocumentFormProps {
  form: UseFormReturn<UploadFormData>;
  onSubmit: (data: UploadFormData) => Promise<void>;
  isUploading?: boolean;
}

export function UploadDocumentForm({ form, onSubmit, isUploading = false }: UploadDocumentFormProps) {
  const artworkId = useWatch({ control: form.control, name: "artwork_id" });
  const collectionId = useWatch({ control: form.control, name: "collection_id" });
  const artistId = useWatch({ control: form.control, name: "artist_id" });
  
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (artworkId && artworkId !== "no_artwork" && artworkId !== "") {
      form.setValue("collection_id", "");
      form.setValue("artist_id", "");
      setValidationError(null);
    }
  }, [artworkId, form]);

  useEffect(() => {
    if (collectionId && collectionId !== "no_collection" && collectionId !== "") {
      form.setValue("artwork_id", "");
      form.setValue("artist_id", "");
      setValidationError(null);
    }
  }, [collectionId, form]);

  useEffect(() => {
    if (artistId && artistId !== "no_artist" && artistId !== "") {
      form.setValue("artwork_id", "");
      form.setValue("collection_id", "");
      setValidationError(null);
    }
  }, [artistId, form]);

  const handleSubmit = async (data: UploadFormData) => {
    try {
      const hasArtwork = data.artwork_id && data.artwork_id !== "no_artwork" && data.artwork_id !== "";
      const hasCollection = data.collection_id && data.collection_id !== "no_collection" && data.collection_id !== "";
      const hasArtist = data.artist_id && data.artist_id !== "no_artist" && data.artist_id !== "";
      
      const selectedEntities = [hasArtwork, hasCollection, hasArtist].filter(Boolean).length;
      
      if (selectedEntities === 0) {
        setValidationError("Please attach document to either an artwork, collection, or artist");
        return;
      }
      
      if (selectedEntities > 1) {
        setValidationError("Document can only be attached to one entity: artwork, collection, or artist");
        return;
      }

      setValidationError(null);
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const hasArtworkSelected = artworkId && artworkId !== "no_artwork" && artworkId !== "";
  const hasCollectionSelected = collectionId && collectionId !== "no_collection" && collectionId !== "";
  const hasArtistSelected = artistId && artistId !== "no_artist" && artistId !== "";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FileUploadField form={form} />
        <DocumentTypeField form={form} />
        
        {validationError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-4">
          <ArtworkField form={form} disabled={!!hasCollectionSelected || !!hasArtistSelected} />
          <CollectionField form={form} disabled={!!hasArtworkSelected || !!hasArtistSelected} />
          <ArtistField form={form} disabled={!!hasArtworkSelected || !!hasCollectionSelected} />
        </div>
        
        <DescriptionField form={form} />
        <Button 
          type="submit" 
          disabled={isUploading} 
          className="w-full relative"
        >
          <Upload className="mr-2 h-4 w-4" />
          <span>
            {isUploading ? "Uploading..." : "Upload"}
          </span>
          {isUploading && (
            <span 
              className="absolute inset-0 flex items-center justify-center" 
              aria-hidden="true"
            >
              <span className="animate-pulse">Processing...</span>
            </span>
          )}
        </Button>
      </form>
    </Form>
  );
}
