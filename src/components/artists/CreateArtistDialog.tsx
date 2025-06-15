import {
  ScrollableDialog,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogTitle,
  ScrollableDialogBody,
} from "@/components/ui/scrollable-dialog";
import { useCreateArtistForm } from "./hooks/useCreateArtistForm";
import { CreateArtistFormView } from "./CreateArtistFormView";

interface CreateArtistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateArtistDialog = ({ open, onOpenChange }: CreateArtistDialogProps) => {
  const handleSuccess = () => {
    onOpenChange(false);
  };

  const { form, handleSubmit, isLoading, errors, resetForm } = useCreateArtistForm({ 
    onSuccess: handleSuccess 
  });

  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm(); // Reset form when dialog closes
    }
    onOpenChange(isOpen);
  };
  
  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <ScrollableDialog open={open} onOpenChange={handleDialogClose}>
      <ScrollableDialogContent size="md">
        <ScrollableDialogHeader>
          <ScrollableDialogTitle>Add New Artist</ScrollableDialogTitle>
        </ScrollableDialogHeader>
        <ScrollableDialogBody>
          <CreateArtistFormView
            form={form}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            errors={errors}
            onCancel={handleCancel}
          />
        </ScrollableDialogBody>
      </ScrollableDialogContent>
    </ScrollableDialog>
  );
};
