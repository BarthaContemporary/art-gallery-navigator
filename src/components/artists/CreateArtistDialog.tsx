
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface CreateArtistForm {
  full_name: string;
  birth_year?: number;
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

      // Fix: Check if FileList exists and has at least one file
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
        birth_year: data.birth_year || null,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
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
