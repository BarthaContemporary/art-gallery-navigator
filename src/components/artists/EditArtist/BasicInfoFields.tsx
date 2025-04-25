
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormRegister, FieldErrors } from "react-hook-form";
import { EditArtistForm } from "@/hooks/use-edit-artist-form";

interface BasicInfoFieldsProps {
  register: UseFormRegister<EditArtistForm>;
  errors: FieldErrors<EditArtistForm>;
}

export function BasicInfoFields({ register, errors }: BasicInfoFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name *</Label>
        <Input
          id="full_name"
          {...register("full_name", { required: "Full name is required" })}
        />
        {errors.full_name && (
          <span className="text-red-500 text-xs">{errors.full_name.message}</span>
        )}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email", {
            pattern: {
              value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
              message: "Invalid email address"
            }
          })}
        />
        {errors.email && (
          <span className="text-red-500 text-xs">{errors.email.message as string}</span>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="birth_year">Birth Year</Label>
        <Input
          id="birth_year"
          type="number"
          {...register("birth_year", {
            valueAsNumber: true,
            validate: value =>
              !value ||
              (value > 1800 && value <= new Date().getFullYear()) ||
              "Please enter a valid year",
          })}
        />
        {errors.birth_year && (
          <span className="text-red-500 text-xs">{errors.birth_year.message}</span>
        )}
      </div>
    </>
  );
}
