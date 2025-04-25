
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
import { 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  FileArchive, 
  FileCheck, 
  FileQuestion 
} from "lucide-react";

interface DocumentTypeFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

const DOCUMENT_TYPES = [
  { 
    value: "condition report", 
    label: "Condition Report", 
    icon: FileText 
  },
  { 
    value: "invoice", 
    label: "Invoice", 
    icon: FileSpreadsheet 
  },
  { 
    value: "provenance", 
    label: "Provenance", 
    icon: FileCheck 
  },
  { 
    value: "CoA", 
    label: "Certificate of Authenticity", 
    icon: FileText 
  },
  { 
    value: "loan agreement", 
    label: "Loan Agreement", 
    icon: FileText 
  },
  { 
    value: "image zip", 
    label: "Image ZIP", 
    icon: FileImage 
  },
  { 
    value: "related file", 
    label: "Related File", 
    icon: FileArchive 
  },
];

export function DocumentTypeField({ form, disabled }: DocumentTypeFieldProps) {
  // Get the current value or default to "_none" if empty
  const currentValue = form.watch("type") || "_none";
  
  return (
    <FormField
      control={form.control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Document Type</FormLabel>
          <FormControl>
            <SearchableSelect
              options={DOCUMENT_TYPES.map(type => ({
                value: type.value,
                label: type.label,
                icon: type.icon
              }))}
              value={field.value || "_none"}
              onChange={(value) => {
                // Only set actual values, not placeholder
                field.onChange(value === "_none" ? "" : value);
              }}
              placeholder="Select type..."
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
