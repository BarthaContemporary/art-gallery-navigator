
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { Artist } from "@/hooks/useArtists"; // Import the standardized Artist type

interface BasicInformationFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
  artists: Artist[] | undefined; // Use the standardized Artist type
}

export function BasicInformationFields({ form, artists }: BasicInformationFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="artist_id"
        rules={{ required: "Artist is required" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Artist</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an artist" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {/* artists?.map will now iterate over Artist[] which includes full_name */}
                {artists?.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>
                    {artist.full_name}
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
        name="title"
        rules={{ required: "Title is required" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="year"
        rules={{ required: "Year is required" }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Year</FormLabel>
            <FormControl>
              <Input type="number" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
