
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect } from "react";

interface EditArtistDialogProps {
  artist: {
    id: string;
    full_name: string;
    birth_year: number | null;
    nationality: string | null;
    biography: string | null;
    image_url: string | null;
    representation_status: string | null;
    email?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RepresentationStatus = "represented" | "formerly represented" | "not represented";

const statusOptions: { label: string; value: RepresentationStatus }[] = [
  { label: "Represented", value: "represented" },
  { label: "Formerly Represented", value: "formerly represented" },
  { label: "Not Represented", value: "not represented" },
];

interface EditArtistForm {
  full_name: string;
  birth_year?: number;
  nationality?: string;
  biography?: string;
  image?: FileList;
  representation_status: RepresentationStatus;
  email?: string;
}

export function EditArtistDialog({ artist, open, onOpenChange }: EditArtistDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditArtistForm>({
    defaultValues: {
      full_name: artist.full_name,
      birth_year: artist.birth_year || undefined,
      nationality: artist.nationality || "",
      biography: artist.biography || "",
      representation_status: (artist.representation_status as RepresentationStatus) || "not represented",
      email: artist.email || "",
    },
  });

  const onSubmit = async (data: EditArtistForm) => {
    try {
      setIsLoading(true);

      let image_url = artist.image_url;

      // If image changed, upload it
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

      const { error } = await supabase.from('artists').update({
        full_name: data.full_name,
        birth_year: data.birth_year ?? null,
        nationality: data.nationality ?? null,
        biography: data.biography ?? null,
        representation_status: data.representation_status,
        image_url,
        email: data.email || null,
      }).eq('id', artist.id);

      if (error) throw error;

      toast.success("Artist updated successfully");
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      onOpenChange(false);
      reset();
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to update artist");
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when the artist or dialog open state changes
  useEffect(() => {
    if (open) {
      reset({
        full_name: artist.full_name,
        birth_year: artist.birth_year || undefined,
        nationality: artist.nationality || "",
        biography: artist.biography || "",
        representation_status: (artist.representation_status as RepresentationStatus) || "not represented",
        email: artist.email || "",
      });
    }
  }, [open, artist, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px]" 
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Artist</DialogTitle>
          <DialogDescription>
            Make changes to artist details. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form 
          className="space-y-4" 
          onSubmit={(e) => {
            e.stopPropagation();
            handleSubmit(onSubmit)(e);
          }}
        >
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
            <Label htmlFor="representation_status">Representation Status</Label>
            <select
              id="representation_status"
              className="w-full border px-3 py-2 rounded text-gray-900"
              {...register("representation_status")}
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">Profile Image</Label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              {...register("image")}
            />
            {artist.image_url && (
              <img
                src={artist.image_url}
                alt={artist.full_name}
                className="w-16 h-16 rounded-md mt-2 object-cover"
              />
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }} 
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
