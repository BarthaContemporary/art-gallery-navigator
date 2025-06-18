
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CirclePlus } from "lucide-react";
import { useCreateClientForm } from "./hooks/useCreateClientForm";
import { ClientFormFields } from "./ClientFormFields";

export function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const { formData, updateFormData, handleSubmit, resetForm, isLoading } = useCreateClientForm();

  const onSubmit = (e: React.FormEvent) => {
    handleSubmit(e);
    if (!e.defaultPrevented) {
      setOpen(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex gap-2">
          <CirclePlus className="h-4 w-4" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <ClientFormFields 
            formData={formData}
            onFormDataChange={updateFormData}
          />
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
