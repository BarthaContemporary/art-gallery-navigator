
import { CreateArtworkFormView } from "./form/CreateArtworkFormView"; // Corrected import path
import { useCreateArtworkForm, UseCreateArtworkFormProps } from "./form/useCreateArtworkForm";

export function CreateArtworkForm({ setOpen, initialData, preventFreeze }: UseCreateArtworkFormProps) {
  const {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    handleImagesUploaded,
    // initialData: formInitialData, // already available via prop
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
    />
  );
}
