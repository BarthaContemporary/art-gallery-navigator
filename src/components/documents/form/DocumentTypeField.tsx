
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { UploadFormData } from "../upload-document-schema";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface DocumentTypeFieldProps {
  form: UseFormReturn<UploadFormData>;
}

const DOCUMENT_TYPES = [
  { value: "condition report", label: "Condition Report" },
  { value: "invoice", label: "Invoice" },
  { value: "provenance", label: "Provenance" },
  { value: "CoA", label: "Certificate of Authenticity" },
  { value: "loan agreement", label: "Loan Agreement" },
  { value: "image zip", label: "Image ZIP" },
  { value: "related file", label: "Related File" },
];

export function DocumentTypeField({ form }: DocumentTypeFieldProps) {
  return (
    <FormField
      control={form.control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Document Type</FormLabel>
          <FormControl>
            <SearchableSelect
              options={DOCUMENT_TYPES}
              value={field.value || ""}
              onChange={field.onChange}
              placeholder="Select type..."
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
