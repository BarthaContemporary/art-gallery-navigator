import React, { useEffect, useImperativeHandle, forwardRef } from "react";
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
  enableAutosave?: boolean;
  onAutosaveStatusChange?: (status: 'idle' | 'saving' | 'saved' | 'error') => void;
}

export interface CreateArtworkFormRef {
  submitForm: () => void;
}

export const CreateArtworkForm = forwardRef<CreateArtworkFormRef, CreateArtworkFormProps>(({
  setOpen,
  initialData,
  preventFreeze,
  hideSubmitButton,
  formId,
  onSuccessCallback,
  onSavingChange,
  scrollToFirstError,
  enableAutosave = false,
  onAutosaveStatusChange
}, ref) => {
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
    isSaving,
    isAdmin,
    currentUserArtist,
    autosaveStatus
  } = useCreateArtworkForm({ 
    setOpen, 
    initialData, 
    preventFreeze, 
    onSuccessCallback, 
    enableAutosave 
  });

  useEffect(() => {
    if (onSavingChange) {
      onSavingChange(isSaving);
    }
  }, [isSaving, onSavingChange]);

  useEffect(() => {
    if (onAutosaveStatusChange) {
      onAutosaveStatusChange(autosaveStatus);
    }
  }, [autosaveStatus, onAutosaveStatusChange]);

  // Expose submitForm method via ref
  useImperativeHandle(ref, () => ({
    submitForm: () => {
      console.log("submitForm called via ref");
      const formData = form.getValues();
      console.log("Current form data:", formData);
      
      // Validate the form first
      form.trigger().then((isValid) => {
        console.log("Form validation result:", isValid);
        if (isValid) {
          onSubmit(formData);
        } else {
          console.log("Form has validation errors:", form.formState.errors);
          if (scrollToFirstError) {
            scrollToFirstError();
          }
        }
      });
    }
  }), [form, onSubmit, scrollToFirstError]);

  const handleSubmit = (data: ArtworkFormData) => {
    console.log("handleSubmit called with:", data);
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
      scrollToFirstError={scrollToFirstError}
      autosaveStatus={autosaveStatus}
      enableAutosave={enableAutosave}
    />
  );
});