
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useArtworks } from "@/hooks/use-artworks";
import { UseFormReturn } from "react-hook-form";
import { UploadFormData } from "../upload-document-schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ArtworkFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function ArtworkField({ form, disabled }: ArtworkFieldProps) {
  const { data: artworks } = useArtworks();

  return (
    <FormField
      control={form.control}
      name="artwork_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Related Artwork</FormLabel>
          <FormControl>
            <Select
              disabled={disabled}
              value={field.value || ""}
              onValueChange={field.onChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select artwork..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">None</SelectItem>
                {artworks?.map((artwork) => (
                  <SelectItem key={artwork.id} value={artwork.id}>
                    {artwork.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
