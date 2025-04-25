
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

interface UploadDocumentFormProps {
  form: UseFormReturn<UploadFormData>;
  onSubmit: (data: UploadFormData) => Promise<void>;
}

export function UploadDocumentForm({ form, onSubmit }: UploadDocumentFormProps) {
  const artworkId = useWatch({ control: form.control, name: "artwork_id" });
  const collectionId = useWatch({ control: form.control, name: "collection_id" });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FileUploadField form={form} />
        <DocumentTypeField form={form} />
        <ArtworkField form={form} disabled={!!collectionId} />
        <CollectionField form={form} disabled={!!artworkId} />
        <DescriptionField form={form} />
        <Button type="submit">
          <Upload className="mr-2 h-4 w-4" /> Upload
        </Button>
      </form>
    </Form>
  );
}
