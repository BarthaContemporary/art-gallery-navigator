
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label"; // Replaced by FormLabel
import { UseFormReturn } from "react-hook-form";
import { EditArtistFormValues } from "@/schemas/artistSchema";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface ExtendedBasicInfoFieldsProps {
  form: UseFormReturn<EditArtistFormValues>;
}

export function ExtendedBasicInfoFields({ form }: ExtendedBasicInfoFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="place_of_birth"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Place of Birth</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="place_of_death"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Place of Death</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
