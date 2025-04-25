
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

interface UploadDocumentFormProps {
  form: UseFormReturn<UploadFormData>;
  onSubmit: (data: UploadFormData) => Promise<void>;
}

export function UploadDocumentForm({ form, onSubmit }: UploadDocumentFormProps) {
  const artworkId = useWatch({ control: form.control, name: "artwork_id" });
  const collectionId = useWatch({ control: form.control, name: "collection_id" });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset other field when one is selected
  useEffect(() => {
    if (artworkId && artworkId !== "_none") {
      form.setValue("collection_id", "");
    }
  }, [artworkId, form]);

  useEffect(() => {
    if (collectionId && collectionId !== "_none") {
      form.setValue("artwork_id", "");
    }
  }, [collectionId, form]);

  // Process form data before submission
  const handleSubmit = async (data: UploadFormData) => {
    try {
      setIsSubmitting(true);
      
      // Clean up form data
      const processedData = {
        ...data,
        artwork_id: data.artwork_id === "_none" ? "" : data.artwork_id,
        collection_id: data.collection_id === "_none" ? "" : data.collection_id,
        artist_id: data.artist_id === "_none" ? "" : data.artist_id
      };
      
      await onSubmit(processedData);
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
        <ArtworkField form={form} disabled={!!hasCollectionSelected} />
        <CollectionField form={form} disabled={!!hasArtworkSelected} />
        <DescriptionField form={form} />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          <Upload className="mr-2 h-4 w-4" /> 
          {isSubmitting ? "Uploading..." : "Upload"}
        </Button>
      </form>
    </Form>
  );
}
