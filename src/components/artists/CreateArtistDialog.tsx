import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CreateArtistForm {
  full_name: string;
  surname_first_letter?: string;
  birth_year?: number;
  death_year?: number;
  place_of_birth?: string;
  place_of_death?: string;
  nationality?: string;
  biography?: string;
  image?: FileList;
  email?: string;
}

interface CreateArtistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateArtistDialog = ({ open, onOpenChange }: CreateArtistDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateArtistForm>();

  const onSubmit = async (data: CreateArtistForm) => {
    try {
      setIsLoading(true);

      let image_url = null;

      if (data.image && data.image.length > 0) {
        const imageFile = data.image[0];
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('gallery_images')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('gallery_images')
          .getPublicUrl(filePath);

        image_url = publicUrl;
      }

      const { error } = await supabase.from('artists').insert({
        full_name: data.full_name,
        surname_first_letter: data.surname_first_letter || null,
        birth_year: data.birth_year || null,
        death_year: data.death_year || null,
        place_of_birth: data.place_of_birth || null,
        place_of_death: data.place_of_death || null,
        nationality: data.nationality || null,
        biography: data.biography || null,
        email: data.email || null,
        image_url
      });

      if (error) throw error;

      toast.success("Artist created successfully");
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating artist:', error);
      toast.error("Failed to create artist");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) reset(); onOpenChange(isOpen); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Artist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name *</Label>
            <Input
              id="full_name"
              {...register("full_name", { required: "Full name is required" })}
            />
            {errors.full_name && (
              <p className="text-sm text-red-500">{errors.full_name.message}</p>
            )}
          </div>

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
              <p className="text-sm text-red-500">{errors.surname_first_letter.message}</p>
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
              <p className="text-sm text-red-500">{errors.email.message as string}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_year">Birth Year</Label>
              <Input
                id="birth_year"
                type="number"
                {...register("birth_year", {
                  valueAsNumber: true,
                  validate: (value) =>
                    !value || (value > 1800 && value <= new Date().getFullYear()) ||
                    "Please enter a valid year"
                })}
              />
              {errors.birth_year && (
                <p className="text-sm text-red-500">{errors.birth_year.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="death_year">Death Year</Label>
              <Input
                id="death_year"
                type="number"
                {...register("death_year", {
                  valueAsNumber: true,
                  validate: (value) =>
                    !value || (value > 1800 && value <= new Date().getFullYear() + 10) ||
                    "Please enter a valid year"
                })}
              />
              {errors.death_year && (
                <p className="text-sm text-red-500">{errors.death_year.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="place_of_birth">Place of Birth</Label>
              <Input
                id="place_of_birth"
                {...register("place_of_birth")}
              />
              {errors.place_of_birth && (
                <p className="text-sm text-red-500">{errors.place_of_birth.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="place_of_death">Place of Death</Label>
              <Input
                id="place_of_death"
                {...register("place_of_death")}
              />
              {errors.place_of_death && (
                <p className="text-sm text-red-500">{errors.place_of_death.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nationality">Nationality</Label>
            <Input
              id="nationality"
              {...register("nationality")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="biography">Biography</Label>
            <Textarea
              id="biography"
              {...register("biography")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Profile Image</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              {...register("image")}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" type="button" onClick={() => { reset(); onOpenChange(false); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Artist"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
