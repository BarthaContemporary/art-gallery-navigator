
import { CreateArtworkFormView } from "./form/CreateArtworkFormView"; // Corrected import path
import { useCreateArtworkForm, UseCreateArtworkFormProps } from "./form/useCreateArtworkForm";

export interface CreateArtworkFormProps extends UseCreateArtworkFormProps {
  hideSubmitButton?: boolean;
}

export function CreateArtworkForm({ 
  setOpen, 
  initialData, 
  preventFreeze,
  hideSubmitButton = false 
}: CreateArtworkFormProps) {
  const {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    handleImagesUploaded,
    isSaving,
    isAdmin, // Get from the hook
    currentUserArtist // Get from the hook
  } = useCreateArtworkForm({ setOpen, initialData, preventFreeze });

  return (
    <CreateArtworkFormView
      form={form}
      classification={classification}
      artists={artists}
      locations={locations}
      handleImagesUploaded={handleImagesUploaded}
      initialData={initialData}
      onSubmit={onSubmit}
      isAdmin={isAdmin} // Pass down
      currentUserArtist={currentUserArtist} // Pass down
      hideSubmitButton={hideSubmitButton}
    />
  );
}
