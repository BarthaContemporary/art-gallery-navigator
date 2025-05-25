import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArtworkFormData } from "./types";
import { Artist } from "@/hooks/useArtists"; // Standardized Artist type

interface BasicInformationFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
  artists: Artist[] | undefined;
  isAdmin: boolean; // New prop
  currentUserArtistId?: string; // New prop, artist ID of the logged-in user if they are an artist
}

export function BasicInformationFields({ form, artists, isAdmin, currentUserArtistId }: BasicInformationFieldsProps) {
  const isArtistMode = !isAdmin && !!currentUserArtistId;

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input placeholder="Artwork Title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="artist_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Artist</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value}
              disabled={isArtistMode} // Disable if in artist mode
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select an artist" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {artists?.map((artist) => (
                  <SelectItem key={artist.id} value={artist.id}>
                    {artist.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isArtistMode && artists?.find(a => a.id === currentUserArtistId) && (
              <p className="text-sm text-muted-foreground mt-1">
                Artist set to: {artists.find(a => a.id === currentUserArtistId)?.full_name}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="year"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Year</FormLabel>
            <FormControl>
              <Input type="number" placeholder="YYYY" {...field} onChange={e => field.onChange(e.target.value === '' ? null : parseInt(e.target.value))} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="medium_type"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Medium Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select medium type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="Painting">Painting</SelectItem>
                <SelectItem value="Sculpture">Sculpture</SelectItem>
                <SelectItem value="Photography">Photography</SelectItem>
                <SelectItem value="Work on Paper">Work on Paper</SelectItem>
                <SelectItem value="Installation">Installation</SelectItem>
                <SelectItem value="Video">Video</SelectItem>
                <SelectItem value="Textile Arts">Textile Arts</SelectItem>
                <SelectItem value="Book">Book</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="materials"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Materials</FormLabel>
            <FormControl>
              <Textarea placeholder="e.g. Oil on canvas" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
