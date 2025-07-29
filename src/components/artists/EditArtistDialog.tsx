
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { BasicInfoFields } from "./EditArtist/BasicInfoFields";
import { ExtendedBasicInfoFields } from "./EditArtist/ExtendedBasicInfoFields";
import { AdditionalInfoFields } from "./EditArtist/AdditionalInfoFields";
import { ImageUploadField } from "./EditArtist/ImageUploadField";
import { useEditArtistForm } from "@/hooks/use-edit-artist-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EditArtistFormValues, representationStatusSchema } from "@/schemas/artistSchema";
import { useScrollableDialog } from "@/hooks/use-scrollable-dialog";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useArtistAutosave } from "@/hooks/use-artist-autosave";

interface ArtistData { // Define a type for the artist data structure consistent with useEditArtistForm
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
  representation_status: string; // Assuming string here
  email?: string | null;
}

interface EditArtistDialogProps {
  artist: ArtistData; // Use the ArtistData type
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { label: "Represented", value: "represented" },
  { label: "Formerly Represented", value: "formerly represented" },
  { label: "Not Represented", value: "not represented" },
];

export function EditArtistDialog({ artist, open, onOpenChange }: EditArtistDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { form, isLoading, onSubmit } = useEditArtistForm({
    artist,
    onSuccess: () => onOpenChange(false)
  });

  const { scrollContainerRef, scrollToFirstError } = useScrollableDialog(open);

  // Enable autosave
  useArtistAutosave({
    form,
    artistId: artist.id,
    enabled: open
  });

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('artists')
        .delete()
        .eq('id', artist.id);

      if (error) throw error;

      toast.success("Artist deleted successfully");
      setShowDeleteConfirm(false);
      onOpenChange(false);
    } catch (error) {
      logger.error('Error deleting artist:', error);
      toast.error("Failed to delete artist");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: artist.full_name || "",
        surname_first_letter: artist.surname_first_letter || "",
        email: artist.email || "",
        birth_year: artist.birth_year ?? undefined,
        death_year: artist.death_year ?? undefined,
        place_of_birth: artist.place_of_birth || "",
        place_of_death: artist.place_of_death || "",
        nationality: artist.nationality || "",
        biography: artist.biography || "",
        representation_status: representationStatusSchema.parse(artist.representation_status || "not represented"),
        image: undefined, 
      });
    }
  }, [open, artist, form.reset]);

  useEffect(() => {
    if (form.formState.submitCount > 0 && !form.formState.isValid && Object.keys(form.formState.errors).length > 0) {
      setTimeout(() => {
        scrollToFirstError();
      }, 100);
    }
  }, [form.formState.submitCount, form.formState.isValid, form.formState.errors, scrollToFirstError]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px] h-[90vh] max-h-[800px] flex flex-col p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Edit Artist</DialogTitle>
          <DialogDescription>
            Make changes to artist details. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full px-6" ref={scrollContainerRef}>
            <Form {...form}>
            <form 
              className="space-y-4" 
              onSubmit={(e) => {
                e.stopPropagation();
                onSubmit(e);
              }}
            >
              <BasicInfoFields form={form} />
              <ExtendedBasicInfoFields form={form} />
              <AdditionalInfoFields form={form} statusOptions={statusOptions} />
              <ImageUploadField 
                form={form}
                currentImageUrl={artist.image_url}
                artistName={artist.full_name}
              />

              <div className="flex gap-2 justify-between pt-4 border-t">
                <Button 
                  type="button" 
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(true);
                  }} 
                  disabled={isLoading || isDeleting}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenChange(false);
                    }} 
                    disabled={isLoading || isDeleting}
                  >
                    Close
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading || isDeleting}
                    variant="secondary"
                  >
                    {isLoading ? "Saving..." : "Save Now"}
                  </Button>
                </div>
              </div>
            </form>
            </Form>
          </ScrollArea>
        </div>
      </DialogContent>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the artist "{artist.full_name}" and remove all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete Artist"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
