import React, { useEffect } from "react"; // Added useEffect
import { CreateArtworkFormView } from "./form/CreateArtworkFormView";
import { useCreateArtworkForm, UseCreateArtworkFormProps } from "./form/useCreateArtworkForm";
import { ArtworkFormData } from "./form/types";
import { Artwork } from "@/hooks/use-artworks";

interface CreateArtworkFormProps extends UseCreateArtworkFormProps {
  hideSubmitButton?: boolean;
  formId?: string;
  onSuccessCallback?: () => void;
  // New props for state synchronization and actions
  onSavingChange?: (isSaving: boolean) => void;
  scrollToFirstError?: () => void;
}

export function CreateArtworkForm({
  setOpen,
  initialData,
  preventFreeze,
  hideSubmitButton,
  formId,
  onSuccessCallback,
  onSavingChange, // Destructure new prop
  scrollToFirstError // Destructure new prop
}: CreateArtworkFormProps) {
  const {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    uploadedImageUrls,
    handleImagesUploaded,
    handleArtsyImageSelected,
    resetUploaded,
    // initialData: initialDataFromHook, // This is already passed as prop
    isSaving,
    isAdmin,
    currentUserArtist
  } = useCreateArtworkForm({ setOpen, initialData, preventFreeze, onSuccessCallback });

  useEffect(() => {
    if (onSavingChange) {
      onSavingChange(isSaving);
    }
  }, [isSaving, onSavingChange]);

  const handleSubmit = (data: ArtworkFormData) => {
    onSubmit(data);
  };

  return (
    <CreateArtworkFormView
      form={form}
      classification={classification}
      artists={artists || []}
      locations={locations || []}
      handleImagesUploaded={handleImagesUploaded}
      handleArtsyImageSelected={handleArtsyImageSelected}
      initialData={initialData}
      onSubmit={handleSubmit}
      isAdmin={isAdmin}
      currentUserArtist={currentUserArtist}
      hideSubmitButton={hideSubmitButton}
      formId={formId}
      isSaving={isSaving}
      scrollToFirstError={scrollToFirstError} // Pass down
    />
  );
}