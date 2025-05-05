
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocations } from "@/hooks/use-locations";
import { Control } from "react-hook-form";
import { z } from "zod";
import { ProjectFormSchema } from "./schema";

type FormValues = z.infer<typeof ProjectFormSchema>;

interface LocationFieldProps {
  control: Control<FormValues>;
}

export function LocationField({ control }: LocationFieldProps) {
  const { data: locations } = useLocations();
  
  return (
    <FormField
      control={control}
      name="location_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Location</FormLabel>
          <Select
            onValueChange={field.onChange}
            defaultValue={field.value}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select location (optional)" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {locations?.map(location => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
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
