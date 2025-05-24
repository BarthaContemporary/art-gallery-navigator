
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { EditArtistForm } from "@/hooks/use-edit-artist-form";

interface ExtendedBasicInfoFieldsProps {
  register: UseFormRegister<EditArtistForm>;
  errors: FieldErrors<EditArtistForm>;
}

export function ExtendedBasicInfoFields({ register, errors }: ExtendedBasicInfoFieldsProps) {
  return (
    <>
      {/* 
        "First Letter of Surname" and "Year of Death" fields have been moved 
        to BasicInfoFields.tsx for better layout grouping.
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="place_of_birth">Place of Birth</Label>
          <Input
            id="place_of_birth"
            {...register("place_of_birth")}
          />
          {errors.place_of_birth && (
            <span className="text-red-500 text-xs">{errors.place_of_birth.message}</span>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="place_of_death">Place of Death</Label>
          <Input
            id="place_of_death"
            {...register("place_of_death")}
          />
          {errors.place_of_death && (
            <span className="text-red-500 text-xs">{errors.place_of_death.message}</span>
          )}
        </div>
      </div>
    </>
  );
}
