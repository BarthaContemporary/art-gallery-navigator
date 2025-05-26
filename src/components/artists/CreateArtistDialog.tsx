
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent className="sm:max-w-[425px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add New Artist</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-grow p-1">
          <CreateArtistFormView
            form={form}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            errors={errors}
            onCancel={handleCancel}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

