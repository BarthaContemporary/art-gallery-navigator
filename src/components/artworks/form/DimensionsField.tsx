
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";

interface DimensionsFieldProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function DimensionsField({ form }: DimensionsFieldProps) {
  return (
    <FormField
      control={form.control}
      name="dimensions"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Dimensions</FormLabel>
          <FormControl>
            <Input {...field} placeholder="e.g., 100 x 80 cm" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
