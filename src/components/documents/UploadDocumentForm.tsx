
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Upload } from "lucide-react";
import { UploadFormData } from "./upload-document-schema";
import { UseFormReturn } from "react-hook-form";
import { FileUploadField } from "./form/FileUploadField";
import { DocumentTypeField } from "./form/DocumentTypeField";
import { ArtworkField } from "./form/ArtworkField";
import { CollectionField } from "./form/CollectionField";
import { ArtistField } from "./components/documents/ArtistField";
import { DescriptionField } from "./form/DescriptionField";
import { useWatch } from "react-hook-form";
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface UploadDocumentFormProps {
  form: UseFormReturn<UploadFormData>;
  onSubmit: (data: UploadFormData) => Promise<void>;
}

export function UploadDocumentForm({ form, onSubmit }: UploadDocumentFormProps) {
  const artworkId = useWatch({ control: form.control, name: "artwork_id" });
  const collectionId = useWatch({ control: form.control, name: "collection_id" });
  const artistId = useWatch({ control: form.control, name: "artist_id" });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset other fields when one is selected to ensure mutual exclusivity
  useEffect(() => {
    if (artworkId && artworkId !== "_none") {
      form.setValue("collection_id", "_none");
      form.setValue("artist_id", "");
      setValidationError(null);
    }
  }, [artworkId, form]);

  useEffect(() => {
    if (collectionId && collectionId !== "_none") {
      form.setValue("artwork_id", "_none");
      form.setValue("artist_id", "");
      setValidationError(null);
    }
  }, [collectionId, form]);

  useEffect(() => {
    if (artistId && artistId !== "_none" && artistId !== "") {
      form.setValue("artwork_id", "_none");
      form.setValue("collection_id", "_none");
      setValidationError(null);
    }
  }, [artistId, form]);

  // Submit handler with improved validation
  const handleSubmit = async (data: UploadFormData) => {
    try {
      // Validate that exactly one attachment field is set
      const hasArtwork = data.artwork_id && data.artwork_id !== "_none";
      const hasCollection = data.collection_id && data.collection_id !== "_none";
      const hasArtist = data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
      
      const selectedEntities = [hasArtwork, hasCollection, hasArtist].filter(Boolean).length;
      
      if (selectedEntities === 0) {
        setValidationError("Please attach document to either an artwork, collection, or artist");
        return;
      }
      
      if (selectedEntities > 1) {
        setValidationError("Document can only be attached to one entity: artwork, collection, or artist");
        return;
      }

      // Log the selected values for debugging
      console.log("Submitting with values:", {
        artwork_id: hasArtwork ? data.artwork_id : null,
        collection_id: hasCollection ? data.collection_id : null,
        artist_id: hasArtist ? data.artist_id : null,
      });

      setValidationError(null);
      setIsSubmitting(true);
      
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if any field has a non-none value
  const hasArtworkSelected = artworkId && artworkId !== "_none";
  const hasCollectionSelected = collectionId && collectionId !== "_none";
  const hasArtistSelected = artistId && artistId !== "_none" && artistId !== "";

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
        <Button type="submit" disabled={isSubmitting} className="w-full">
          <Upload className="mr-2 h-4 w-4" /> 
          {isSubmitting ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </Form>
  );
}
