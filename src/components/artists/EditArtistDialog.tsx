
import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BasicInfoFields } from "./EditArtist/BasicInfoFields";
import { AdditionalInfoFields } from "./EditArtist/AdditionalInfoFields";
import { ImageUploadField } from "./EditArtist/ImageUploadField";
import { useEditArtistForm } from "@/hooks/use-edit-artist-form";

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

const statusOptions = [
  { label: "Represented", value: "represented" },
  { label: "Formerly Represented", value: "formerly represented" },
  { label: "Not Represented", value: "not represented" },
];

export function EditArtistDialog({ artist, open, onOpenChange }: EditArtistDialogProps) {
  const { form, isLoading, onSubmit } = useEditArtistForm({
    artist,
    onSuccess: () => onOpenChange(false)
  });

  const { register, reset, formState: { errors } } = form;

  useEffect(() => {
    if (open) {
      reset({
        full_name: artist.full_name,
        birth_year: artist.birth_year || undefined,
        nationality: artist.nationality || "",
        biography: artist.biography || "",
        representation_status: artist.representation_status as any || "not represented",
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
            onSubmit(e);
          }}
        >
          <BasicInfoFields register={register} errors={errors} />
          <AdditionalInfoFields register={register} statusOptions={statusOptions} />
          <ImageUploadField 
            register={register}
            currentImageUrl={artist.image_url}
            artistName={artist.full_name}
          />

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
