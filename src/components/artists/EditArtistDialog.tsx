
import { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form"; // Import Form
import { BasicInfoFields } from "./EditArtist/BasicInfoFields";
import { ExtendedBasicInfoFields } from "./EditArtist/ExtendedBasicInfoFields";
import { AdditionalInfoFields } from "./EditArtist/AdditionalInfoFields";
import { ImageUploadField } from "./EditArtist/ImageUploadField";
import { useEditArtistForm } from "@/hooks/use-edit-artist-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditArtistFormValues, representationStatusSchema } from "@/schemas/artistSchema";

interface EditArtistDialogProps {
  artist: {
    id: string;
    full_name: string;
    surname_first_letter?: string | null; 
    birth_year: number | null;
    death_year?: number | null; 
    place_of_birth?: string | null; 
    place_of_death?: string | null; 
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

  // const { register, reset, formState: { errors } } = form; // errors is now part of form.formState

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: artist.full_name || "",
        surname_first_letter: artist.surname_first_letter || "",
        email: artist.email || "",
        birth_year: artist.birth_year || undefined,
        death_year: artist.death_year || undefined,
        place_of_birth: artist.place_of_birth || "",
        place_of_death: artist.place_of_death || "",
        nationality: artist.nationality || "",
        biography: artist.biography || "",
        representation_status: representationStatusSchema.parse(artist.representation_status || "not represented"),
        image: undefined, 
      });
    }
  }, [open, artist, form.reset]); // Use form.reset

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px] flex flex-col max-h-[90vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Edit Artist</DialogTitle>
          <DialogDescription>
            Make changes to artist details. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow p-1">
          <Form {...form}> {/* Use Form provider */}
            <form 
              className="space-y-4" 
              onSubmit={(e) => {
                e.stopPropagation(); // Keep this if needed
                onSubmit(e); // This is now form.handleSubmit(actualSubmitFunctionFromHook)
              }}
            >
              <BasicInfoFields form={form} /> {/* Pass the whole form object */}
              <ExtendedBasicInfoFields form={form} /> {/* Pass the whole form object */}
              <AdditionalInfoFields form={form} statusOptions={statusOptions} /> {/* Pass the whole form object */}
              <ImageUploadField 
                form={form} // Pass form for register
                currentImageUrl={artist.image_url}
                artistName={artist.full_name}
              />

              <div className="flex gap-2 justify-end pt-2">
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
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
