
import { useState, useCallback, useEffect } from "react";
import { Collection, useUpdateCollection } from "@/hooks/use-collections";
import { useArtworks } from "@/hooks/use-artworks";
import { toast } from "sonner";

interface UseEditCollectionFormProps {
  collection: Collection;
  onCloseDialog: () => void;
}

export function useEditCollectionForm({ collection, onCloseDialog }: UseEditCollectionFormProps) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description || "");
  const [selectedArtworks, setSelectedArtworks] = useState<string[]>(
    collection.artworks?.map(artwork => artwork.id) || []
  );
  const [emails, setEmails] = useState<string[]>(collection.external_emails || []);
  const [currentEmail, setCurrentEmail] = useState("");
  
  const { data: artworks, isLoading: artworksLoading } = useArtworks();
  const { mutate: updateCollection, isPending: isUpdating } = useUpdateCollection();

  // Using a ref to track mounted state is safer for async operations
  const isMounted =_useIsMounted();

  useEffect(() => {
    // Reset form fields when the collection prop changes (e.g., dialog reopens with a different collection)
    setName(collection.name);
    setDescription(collection.description || "");
    setSelectedArtworks(collection.artworks?.map(artwork => artwork.id) || []);
    setEmails(collection.external_emails || []);
    setCurrentEmail("");
  }, [collection]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for the collection.");
      return;
    }

    // Using setTimeout to ensure the update runs in the next tick, can be useful for UI updates.
    // Consider if this is still necessary or if direct mutation is fine.
    setTimeout(() => {
      updateCollection(
        { 
          id: collection.id, 
          name, 
          description,
          artworkIds: selectedArtworks,
          externalEmails: emails.length > 0 ? emails : undefined
        },
        {
          onSuccess: () => {
            toast.success("Collection updated successfully");
            if (isMounted.current) {
              onCloseDialog();
            }
          },
          onError: (error) => {
            toast.error("Failed to update collection: " + error.message);
          },
        }
      );
    }, 0);
  }, [name, description, selectedArtworks, emails, collection.id, updateCollection, onCloseDialog, isMounted]);

  const toggleArtwork = useCallback((id: string) => {
    setSelectedArtworks((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleAddEmail = useCallback(() => {
    if (currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail)) {
      if (!emails.includes(currentEmail)) {
        setEmails(prev => [...prev, currentEmail]);
        setCurrentEmail("");
      } else {
        toast.error("Email already added");
      }
    } else if (currentEmail) {
      toast.error("Please enter a valid email address");
    }
  }, [currentEmail, emails]);

  const removeEmail = useCallback((emailToRemove: string) => {
    setEmails(emails => emails.filter(email => email !== emailToRemove));
  }, []);
  
  // Helper hook to track mounted state
  function _useIsMounted() {
    const isMountedRef = React.useRef(true);
    useEffect(() => {
      isMountedRef.current = true;
      return () => { isMountedRef.current = false; };
    }, []);
    return isMountedRef;
  }


  return {
    name,
    setName,
    description,
    setDescription,
    selectedArtworks,
    toggleArtwork,
    artworks,
    artworksLoading,
    emails,
    currentEmail,
    setCurrentEmail,
    handleAddEmail,
    removeEmail,
    handleSubmit,
    isUpdating,
  };
}
