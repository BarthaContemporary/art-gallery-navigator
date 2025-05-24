
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
      <div className="space-y-2">
        <Label htmlFor="surname_first_letter">First Letter of Surname</Label>
        <Input
          id="surname_first_letter"
          {...register("surname_first_letter", {
            maxLength: { value: 1, message: "Should be a single letter" },
            setValueAs: (value) => value?.toUpperCase() || ""
          })}
        />
        {errors.surname_first_letter && (
          <span className="text-red-500 text-xs">{errors.surname_first_letter.message}</span>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="death_year">Year of Death</Label>
        <Input
          id="death_year"
          type="number"
          {...register("death_year", {
            valueAsNumber: true,
            validate: value =>
              !value || // Allow empty
              (typeof value === 'number' && value > 1800 && value <= new Date().getFullYear() + 10) || // Allow future for recent deaths
              "Please enter a valid year",
          })}
        />
        {errors.death_year && (
          <span className="text-red-500 text-xs">{errors.death_year.message}</span>
        )}
      </div>
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
