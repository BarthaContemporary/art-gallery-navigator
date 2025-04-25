
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
import { SearchableSelect } from "@/components/ui/searchable-select";

interface ArtworkFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function ArtworkField({ form, disabled }: ArtworkFieldProps) {
  const { data: artworks = [] } = useArtworks();

  const options = artworks.map((artwork) => ({
    value: artwork.id,
    label: artwork.title || "Untitled artwork",
  }));

  return (
    <FormField
      control={form.control}
      name="artwork_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Related Artwork</FormLabel>
          <FormControl>
            <SearchableSelect
              options={options}
              value={field.value || "_none"}
              onChange={field.onChange}
              placeholder="Select artwork..."
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
