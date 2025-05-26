
import { useState, useCallback } from "react";
import { useCreateCollection } from "@/hooks/use-collections";
import { toast } from "sonner";

interface UseCreateCollectionFormProps {
  afterCreate?: () => void;
  onCloseDialog: () => void;
}

export function useCreateCollectionForm({ afterCreate, onCloseDialog }: UseCreateCollectionFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");

  const createCollectionMutation = useCreateCollection();

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setSelectedArtworks([]);
    setEmails([]);
    setCurrentEmail("");
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name for the collection.");
      return;
    }

    createCollectionMutation.mutate(
      {
        name,
        description,
        artworkIds: selectedArtworks,
        externalEmails: emails.length > 0 ? emails : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Collection created!");
          resetForm();
          onCloseDialog();
          afterCreate?.();
        },
        onError: (error) => {
          console.error("Error creating collection:", error);
          toast.error("Failed to create collection.");
        },
      }
    );
  };

  const handleAddEmail = () => {
    if (currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      if (!emails.includes(currentEmail)) {
        setEmails([...emails, currentEmail]);
        setCurrentEmail("");
      } else {
        toast.error("Email already added");
      }
    } else if (currentEmail) {
      toast.error("Please enter a valid email address");
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails(emails.filter(email => email !== emailToRemove));
  };

  const toggleArtwork = (id: string) => {
    setSelectedArtworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return {
    name,
    setName,
    description,
    setDescription,
    selectedArtworks,
    toggleArtwork,
    emails,
    setEmails,
    currentEmail,
    setCurrentEmail,
    handleAddEmail,
    removeEmail,
    handleCreate,
    resetForm,
    isCreating: createCollectionMutation.isPending,
  };
}
