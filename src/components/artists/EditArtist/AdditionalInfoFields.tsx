
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label"; // Replaced by FormLabel
import { Textarea } from "@/components/ui/textarea";
import { UseFormReturn } from "react-hook-form";
import { EditArtistFormValues } from "@/schemas/artistSchema";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface AdditionalInfoFieldsProps {
  form: UseFormReturn<EditArtistFormValues>;
  statusOptions: { label: string; value: string }[];
}

export function AdditionalInfoFields({ form, statusOptions }: AdditionalInfoFieldsProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="nationality"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Nationality</FormLabel>
            <FormControl>
              <Input {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="biography"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Biography</FormLabel>
            <FormControl>
              <Textarea {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="representation_status"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Representation Status</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
