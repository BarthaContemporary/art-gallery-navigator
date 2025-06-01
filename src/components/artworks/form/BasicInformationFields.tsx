
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UseFormReturn } from "react-hook-form";
import { ArtworkFormData } from "./types";
import { Artist } from "@/hooks/useArtists";

interface BasicInformationFieldsProps {
  form: UseFormReturn<ArtworkFormData>;
  artists: Artist[] | undefined;
  isAdmin: boolean;
  currentUserArtistId?: string;
}

export function BasicInformationFields({ 
  form, 
  artists, 
  isAdmin, 
  currentUserArtistId 
}: BasicInformationFieldsProps) {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title *</FormLabel>
            <FormControl>
              <Input placeholder="Enter artwork title" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Only show artist selection if user is admin */}
      {isAdmin && (
        <FormField
          control={form.control}
          name="artist_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Artist *</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an artist" />
                  </SelectTrigger>
                  <SelectContent>
                    {artists?.map((artist) => (
                      <SelectItem key={artist.id} value={artist.id}>
                        {artist.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Show read-only artist name if user is not admin */}
      {!isAdmin && currentUserArtistId && (
        <FormField
          control={form.control}
          name="artist_id"
          render={() => {
            const currentArtist = artists?.find(a => a.id === currentUserArtistId);
            return (
              <FormItem>
                <FormLabel>Artist</FormLabel>
                <FormControl>
                  <Input 
                    value={currentArtist?.full_name || "Your Artist Profile"} 
                    readOnly 
                    className="bg-gray-100" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      )}

      <FormField
        control={form.control}
        name="year"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Year</FormLabel>
            <FormControl>
              <Input 
                type="number" 
                placeholder="e.g. 2023" 
                {...field}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
              />
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
            <FormLabel>Medium Type *</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select medium type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Painting">Painting</SelectItem>
                  <SelectItem value="Sculpture">Sculpture</SelectItem>
                  <SelectItem value="Drawing">Drawing</SelectItem>
                  <SelectItem value="Photography">Photography</SelectItem>
                  <SelectItem value="Print">Print</SelectItem>
                  <SelectItem value="Mixed Media">Mixed Media</SelectItem>
                  <SelectItem value="Digital Art">Digital Art</SelectItem>
                  <SelectItem value="Installation">Installation</SelectItem>
                  <SelectItem value="Video">Video</SelectItem>
                  <SelectItem value="Performance">Performance</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
