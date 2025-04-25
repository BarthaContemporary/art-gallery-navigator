
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Upload } from "lucide-react";
import { UploadFormData } from "./upload-document-schema";
import { UseFormReturn } from "react-hook-form";
import { FileUploadField } from "./form/FileUploadField";
import { DocumentTypeField } from "./form/DocumentTypeField";
import { ArtworkField } from "./form/ArtworkField";
import { CollectionField } from "./form/CollectionField";
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
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset other field when one is selected
  useEffect(() => {
    if (artworkId && artworkId !== "_none") {
      form.setValue("collection_id", "");
      setValidationError(null);
    }
  }, [artworkId, form]);

  useEffect(() => {
    if (collectionId && collectionId !== "_none") {
      form.setValue("artwork_id", "");
      setValidationError(null);
    }
  }, [collectionId, form]);

  // Process form data before submission
  const handleSubmit = async (data: UploadFormData) => {
    try {
      // Validate that one and only one of artwork_id or collection_id is set
      const hasArtwork = !!data.artwork_id && data.artwork_id !== "_none";
      const hasCollection = !!data.collection_id && data.collection_id !== "_none";
      
      if (!hasArtwork && !hasCollection) {
        setValidationError("Please attach document to either an artwork or a collection");
        return;
      }

      if (hasArtwork && hasCollection) {
        setValidationError("Document cannot be attached to both artwork and collection");
        return;
      }

      setValidationError(null);
      setIsSubmitting(true);
      
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if either field has a non-none value
  const hasArtworkSelected = artworkId && artworkId !== "_none";
  const hasCollectionSelected = collectionId && collectionId !== "_none";

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
          <ArtworkField form={form} disabled={!!hasCollectionSelected} />
          <CollectionField form={form} disabled={!!hasArtworkSelected} />
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
