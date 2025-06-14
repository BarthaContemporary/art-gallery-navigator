
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Keep for standalone labels if any, or remove if all labels are FormLabel
import { UseFormReturn } from "react-hook-form";
import { EditArtistFormValues } from "@/schemas/artistSchema";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface BasicInfoFieldsProps {
  form: UseFormReturn<EditArtistFormValues>;
}

export function BasicInfoFields({ form }: BasicInfoFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem className="space-y-2 col-span-2">
              <FormLabel>Full Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="surname_first_letter"
          render={({ field }) => (
            <FormItem className="space-y-2 col-span-1">
              <FormLabel>Sort Letter</FormLabel>
              <FormControl>
                <Input {...field} value={field.value || ''} onChange={e => field.onChange(e.target.value.toUpperCase())} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <FormField
        control={form.control}
        name="email"
        render={({ field }) => (
          <FormItem className="space-y-2">
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type="email" {...field} value={field.value || ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="birth_year"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Birth Year</FormLabel>
              <FormControl>
                <Input 
                  type="number" 
                  {...field} 
                  value={field.value || ''}
                  onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="death_year"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Year of Death</FormLabel>
              <FormControl>
                 <Input 
                  type="number" 
                  {...field} 
                  value={field.value || ''}
                  onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </>
  );
}
