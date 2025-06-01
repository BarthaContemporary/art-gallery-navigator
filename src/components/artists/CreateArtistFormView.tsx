import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateArtistForm } from "./types";
import { useAuth } from "@/hooks/use-auth";

interface CreateArtistFormViewProps {
  form: UseFormReturn<CreateArtistForm>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isLoading: boolean;
  errors: Record<string, any>;
  onCancel: () => void;
}

const statusOptions = [
  { label: "Represented", value: "represented" },
  { label: "Formerly Represented", value: "formerly represented" },
  { label: "Not Represented", value: "not represented" },
];

export const CreateArtistFormView = ({ 
  form, 
  onSubmit, 
  isLoading, 
  errors, 
  onCancel 
}: CreateArtistFormViewProps) => {
  const { user } = useAuth();
  const { register, setValue, watch } = form;
  const fullNameValue = watch("full_name");

  // Pre-populate with user's full name if available and field is empty
  React.useEffect(() => {
    const userFullName = user?.user_metadata?.full_name || user?.user_metadata?.display_name;
    if (userFullName && !fullNameValue) {
      setValue("full_name", userFullName);
    }
  }, [user, fullNameValue, setValue]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name *</Label>
        <Input
          id="full_name"
          {...register("full_name", { required: "Full name is required" })}
          placeholder="Enter full name"
        />
        {errors.full_name && (
          <p className="text-sm text-destructive">{errors.full_name.message}</p>
        )}
        {user?.user_metadata?.full_name && (
          <p className="text-xs text-muted-foreground">
            Suggested from your profile: {user.user_metadata.full_name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="surname_first_letter">Surname First Letter</Label>
        <Input
          id="surname_first_letter"
          {...register("surname_first_letter")}
          placeholder="Enter first letter of surname"
          maxLength={1}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="birth_year">Birth Year</Label>
          <Input
            id="birth_year"
            type="number"
            {...register("birth_year", { 
              valueAsNumber: true,
              min: { value: 1800, message: "Birth year must be after 1800" },
              max: { value: new Date().getFullYear(), message: "Birth year cannot be in the future" }
            })}
            placeholder="e.g. 1980"
          />
          {errors.birth_year && (
            <p className="text-sm text-destructive">{errors.birth_year.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="death_year">Death Year</Label>
          <Input
            id="death_year"
            type="number"
            {...register("death_year", { 
              valueAsNumber: true,
              min: { value: 1800, message: "Death year must be after 1800" },
              max: { value: new Date().getFullYear(), message: "Death year cannot be in the future" }
            })}
            placeholder="e.g. 2020"
          />
          {errors.death_year && (
            <p className="text-sm text-destructive">{errors.death_year.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="place_of_birth">Place of Birth</Label>
          <Input
            id="place_of_birth"
            {...register("place_of_birth")}
            placeholder="e.g. New York, USA"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="place_of_death">Place of Death</Label>
          <Input
            id="place_of_death"
            {...register("place_of_death")}
            placeholder="e.g. Paris, France"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nationality">Nationality</Label>
        <Input
          id="nationality"
          {...register("nationality")}
          placeholder="e.g. American"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          placeholder="artist@example.com"
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="representation_status">Representation Status</Label>
        <Select onValueChange={(value) => setValue("representation_status", value as any)}>
          <SelectTrigger>
            <SelectValue placeholder="Select representation status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="biography">Biography</Label>
        <Textarea
          id="biography"
          {...register("biography")}
          placeholder="Enter artist biography..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Profile Image</Label>
        <Input
          id="image"
          type="file"
          {...register("image")}
          accept="image/*"
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Creating..." : "Create Artist"}
        </Button>
      </div>
    </form>
  );
};
