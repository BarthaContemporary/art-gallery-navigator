
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
import { Skeleton } from "@/components/ui/skeleton";

interface ArtworkFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function ArtworkField({ form, disabled }: ArtworkFieldProps) {
  const { data: artworks, isLoading } = useArtworks();

  // Create options only when artworks are loaded
  const options = (artworks || []).map((artwork) => ({
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
            {isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <SearchableSelect
                options={options}
                value={field.value || "_none"}
                onChange={(value) => {
                  // Only set actual values, not placeholder
                  field.onChange(value === "_none" ? "" : value);
                }}
                placeholder="Select artwork..."
                disabled={disabled}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
