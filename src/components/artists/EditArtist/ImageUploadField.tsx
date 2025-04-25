
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormRegister } from "react-hook-form";
import { EditArtistForm } from "@/hooks/use-edit-artist-form";

interface ImageUploadFieldProps {
  register: UseFormRegister<EditArtistForm>;
  currentImageUrl: string | null;
  artistName: string;
}

export function ImageUploadField({ register, currentImageUrl, artistName }: ImageUploadFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="image">Profile Image</Label>
      <Input
        id="image"
        type="file"
        accept="image/*"
        {...register("image")}
      />
      {currentImageUrl && (
        <img
          src={currentImageUrl}
          alt={artistName}
          className="w-16 h-16 rounded-md mt-2 object-cover"
        />
      )}
    </div>
  );
}
