
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

interface ArtworkFieldProps {
  form: UseFormReturn<UploadFormData>;
}

export function ArtworkField({ form }: ArtworkFieldProps) {
  const { data: artworks } = useArtworks();

  return (
    <FormField
      control={form.control}
      name="artwork_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Related Artwork</FormLabel>
          <FormControl>
            <select
              {...field}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="">Select artwork...</option>
              {artworks?.map((artwork) => (
                <option key={artwork.id} value={artwork.id}>
                  {artwork.title}
                </option>
              ))}
            </select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
