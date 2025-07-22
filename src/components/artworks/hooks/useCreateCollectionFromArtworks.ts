
import { useState, useCallback } from "react";
import { useCreateCollection } from "@/hooks/use-collections";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Artwork } from "@/types/artwork";

interface UseCreateCollectionFromArtworksProps {
  filteredArtworks: Artwork[];
  onCloseDialog: () => void;
}

export function useCreateCollectionFromArtworks({ 
  filteredArtworks, 
  onCloseDialog 
}: UseCreateCollectionFromArtworksProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [includeAllArtworks, setIncludeAllArtworks] = useState(true);
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);

  const navigate = useNavigate();
  const createCollectionMutation = useCreateCollection();

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setIncludeAllArtworks(true);
    setSelectedArtworkIds([]);
    setEmails([]);
  }, []);

  const toggleArtwork = useCallback((artworkId: string) => {
    setSelectedArtworkIds(prev => 
      prev.includes(artworkId) 
        ? prev.filter(id => id !== artworkId)
        : [...prev, artworkId]
    );
  }, []);

  const getSelectedArtworkIds = useCallback(() => {
    if (includeAllArtworks) {
      return filteredArtworks.map(artwork => artwork.id);
    }
    return selectedArtworkIds;
  }, [includeAllArtworks, filteredArtworks, selectedArtworkIds]);

  const canCreate = title.trim().length > 0 && getSelectedArtworkIds().length > 0;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;

    const artworkIds = getSelectedArtworkIds();
    
    createCollectionMutation.mutate(
      {
        name: title,
        description: description || undefined,
        artworkIds,
        externalEmails: emails.length > 0 ? emails : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Collection created!");
          resetForm();
          onCloseDialog();
          navigate("/collections");
        },
        onError: (error) => {
          console.error("Error creating collection:", error);
          toast.error("Failed to create collection.");
        },
      }
    );
  }, [canCreate, getSelectedArtworkIds, title, description, emails, createCollectionMutation, resetForm, onCloseDialog, navigate]);

  return {
    title,
    setTitle,
    description,
    setDescription,
    includeAllArtworks,
    setIncludeAllArtworks,
    selectedArtworkIds,
    toggleArtwork,
    emails,
    setEmails,
    canCreate,
    handleCreate,
    resetForm,
    isCreating: createCollectionMutation.isPending,
    filteredArtworksCount: filteredArtworks.length,
  };
}
