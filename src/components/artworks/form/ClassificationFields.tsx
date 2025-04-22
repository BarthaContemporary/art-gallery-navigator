
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";

interface ClassificationFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function ClassificationFields({ form }: ClassificationFieldsProps) {
  return (
    <FormField
      control={form.control}
      name="classification"
      rules={{ required: "Classification is required" }}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Classification</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {['Unique', 'Limited Edition', 'Open Edition', 'Unknown Edition'].map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
