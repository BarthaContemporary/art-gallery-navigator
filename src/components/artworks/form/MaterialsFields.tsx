
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";

interface MaterialsFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function MaterialsFields({ form }: MaterialsFieldsProps) {
  return (
    <FormField
      control={form.control}
      name="materials"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Materials</FormLabel>
          <FormControl>
            <Input {...field} placeholder="e.g., Oil on canvas" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
