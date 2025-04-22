
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";

interface MaterialsFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
}

export function MaterialsFields({ form }: MaterialsFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="medium_type"
        rules={{ required: "Medium type is required" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Medium Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select medium type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {['Painting', 'Sculpture', 'Photography', 'Work on Paper', 'Installation', 'Video', 'Textile Arts', 'Book'].map((type) => (
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
    </>
  );
}
