
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { UploadFormData } from "../upload-document-schema";

interface DocumentTypeFieldProps {
  form: UseFormReturn<UploadFormData>;
}

export function DocumentTypeField({ form }: DocumentTypeFieldProps) {
  return (
    <FormField
      control={form.control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Document Type</FormLabel>
          <FormControl>
            <select
              {...field}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">Select type...</option>
              <option value="condition report">Condition Report</option>
              <option value="invoice">Invoice</option>
              <option value="provenance">Provenance</option>
              <option value="CoA">Certificate of Authenticity</option>
              <option value="loan agreement">Loan Agreement</option>
              <option value="image zip">Image ZIP</option>
              <option value="related file">Related File</option>
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
