
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useArtists } from "@/hooks/use-artist";

interface ArtistFieldProps {
  form: UseFormReturn<UploadFormData>;
  disabled?: boolean;
}

export function ArtistField({ form, disabled }: ArtistFieldProps) {
  const { data: artists, isLoading } = useArtists();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter artists based on search term
  const filteredArtists = (artists || [])
    .filter(artist => 
      !searchTerm || 
      artist.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  
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
      name="artist_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Related Artist</FormLabel>
          <FormControl>
            <Select
              disabled={disabled}
              value={field.value || ""}
              onValueChange={(value) => {
                field.onChange(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select artist" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search artists..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-2"
                  />
                </div>
                <SelectItem value="_none">None</SelectItem>
                {filteredArtists.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>
                    {artist.full_name || "Unnamed artist"}
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
