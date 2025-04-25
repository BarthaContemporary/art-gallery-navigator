
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { UploadFormData } from "../upload-document-schema";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  FileText, 
  FileSpreadsheet, 
  FileImage, 
  FileArchive, 
  FileCheck 
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
  return (
    <FormField
      control={form.control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Document Type</FormLabel>
          <FormControl>
            <Select
              disabled={disabled}
              value={field.value}
              onValueChange={field.onChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
