
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormReturn } from "react-hook-form";
import { EditArtistFormValues } from "@/schemas/artistSchema"; // Changed from EditArtistForm
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

interface ImageUploadFieldProps {
  form: UseFormReturn<EditArtistFormValues>; // Use the specific form type
  currentImageUrl: string | null;
  artistName: string;
}

export function ImageUploadField({ form, currentImageUrl, artistName }: ImageUploadFieldProps) {
  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
  };

  return (
    <FormField
      control={form.control}
      name="image"
      render={({ field }) => ( // field prop is not directly used for value/onChange for file input with register
        <FormItem className="space-y-2">
          <FormLabel htmlFor="image">Profile Image</FormLabel>
          <FormControl>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onClick={(e) => e.stopPropagation()} // Prevent dialog close on click
              // For file inputs, react-hook-form's `register` is often more straightforward
              // than using `field.onChange` from `render`.
              // So, we use `form.register` here.
              {...form.register("image")}
            />
          </FormControl>
          <FormMessage />
          {currentImageUrl && !field.value?.[0] && ( // Show current image if no new file is selected
            <img
              src={currentImageUrl}
              alt={artistName}
              className="w-16 h-16 rounded-md mt-2 object-cover"
              onClick={handleImageClick} // Keep this to prevent dialog close on image click if needed
            />
          )}
          {field.value?.[0] && ( // Show preview of selected file
             <img
              src={URL.createObjectURL(field.value[0])}
              alt="Preview"
              className="w-16 h-16 rounded-md mt-2 object-cover"
              onLoad={() => URL.revokeObjectURL(URL.createObjectURL(field.value[0]))} // Clean up object URL
            />
          )}
        </FormItem>
      )}
    />
  );
}
