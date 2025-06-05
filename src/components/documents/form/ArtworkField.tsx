
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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

interface ArtworkFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function ArtworkField({ form, disabled }: ArtworkFieldProps) {
  const { data: artworks, isLoading } = useArtworks();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Create options only when artworks are loaded
  const options = (artworks || [])
    .filter(artwork => 
      !searchTerm || 
      artwork.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .map((artwork) => ({
      value: artwork.id,
      label: artwork.title || "Untitled artwork",
    }));
  
  // Reset search when reopening
  useEffect(() => {
    if (!disabled) {
      setSearchTerm("");
    }
  }, [disabled]);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

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
              onValueChange={(value) => {
                field.onChange(value === "no_artwork" ? "" : value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select artwork" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search artworks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-2"
                  />
                </div>
                <SelectItem value="no_artwork">None</SelectItem>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
