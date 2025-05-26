
import React from "react";
import { UseFormReturn, FieldErrors } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CreateArtistForm } from "./types";

interface CreateArtistFormViewProps {
  form: UseFormReturn<CreateArtistForm>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isLoading: boolean;
  errors: FieldErrors<CreateArtistForm>;
  onCancel: () => void;
}

export const CreateArtistFormView: React.FC<CreateArtistFormViewProps> = ({
  form,
  onSubmit,
  isLoading,
  errors,
  onCancel,
}) => {
  const { register } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="full_name_create">Full Name *</Label>
          <Input
            id="full_name_create"
            {...register("full_name", { required: "Full name is required" })}
          />
          {errors.full_name && (
            <p className="text-sm text-red-500">{errors.full_name.message}</p>
          )}
        </div>
        <div className="space-y-2 col-span-1">
          <Label htmlFor="surname_first_letter_create">Sort Letter</Label>
          <Input
            id="surname_first_letter_create"
            {...register("surname_first_letter", { 
              maxLength: { value: 1, message: "Should be a single letter" },
              setValueAs: (value) => value?.toUpperCase() || ""
            })}
          />
          {errors.surname_first_letter && (
            <p className="text-sm text-red-500">{errors.surname_first_letter.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email_create">Email</Label>
        <Input
          id="email_create"
          type="email"
          {...register("email", {
            pattern: {
              value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
              message: "Invalid email address"
            }
          })}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message as string}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="birth_year_create">Birth Year</Label>
          <Input
            id="birth_year_create"
            type="number"
            {...register("birth_year", {
              valueAsNumber: true,
              validate: (value) =>
                !value || (value > 1000 && value <= new Date().getFullYear()) || // Adjusted min year
                "Please enter a valid year (e.g., >1000)"
            })}
          />
          {errors.birth_year && (
            <p className="text-sm text-red-500">{errors.birth_year.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="death_year_create">Death Year</Label>
          <Input
            id="death_year_create"
            type="number"
            {...register("death_year", {
              valueAsNumber: true,
              validate: (value, formValues) => {
                if (!value) return true;
                const birthYear = formValues.birth_year;
                if (birthYear && value < birthYear) return "Death year cannot be before birth year";
                return (value > 1000 && value <= new Date().getFullYear() + 100) || // Adjusted max year
                       "Please enter a valid year (e.g., >1000)";
              }
            })}
          />
          {errors.death_year && (
            <p className="text-sm text-red-500">{errors.death_year.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="place_of_birth_create">Place of Birth</Label>
          <Input
            id="place_of_birth_create"
            {...register("place_of_birth")}
          />
          {errors.place_of_birth && (
            <p className="text-sm text-red-500">{errors.place_of_birth.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="place_of_death_create">Place of Death</Label>
          <Input
            id="place_of_death_create"
            {...register("place_of_death")}
          />
          {errors.place_of_death && (
            <p className="text-sm text-red-500">{errors.place_of_death.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nationality_create">Nationality</Label>
        <Input
          id="nationality_create"
          {...register("nationality")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="biography_create">Biography</Label>
        <Textarea
          id="biography_create"
          {...register("biography")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="image_create">Profile Image</Label>
        <Input
          id="image_create"
          type="file"
          accept="image/*"
          {...register("image")}
        />
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button variant="outline" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Artist"}
        </Button>
      </div>
    </form>
  );
};

