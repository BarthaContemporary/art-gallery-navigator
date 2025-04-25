
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { UploadFormData } from "../upload-document-schema";

interface FileUploadFieldProps {
  form: UseFormReturn<UploadFormData>;
}

export function FileUploadField({ form }: FileUploadFieldProps) {
  return (
    <FormField
      control={form.control}
      name="file"
      render={({ field: { onChange, value, ...rest } }) => (
        <FormItem>
          <FormLabel>File</FormLabel>
          <FormControl>
            <Input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onChange(file);
              }}
              {...rest}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
