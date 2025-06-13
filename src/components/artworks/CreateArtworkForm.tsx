
import { CreateArtworkFormView } from "./form/CreateArtworkFormView";
import { useCreateArtworkForm, UseCreateArtworkFormProps } from "./form/useCreateArtworkForm";

export interface CreateArtworkFormProps extends UseCreateArtworkFormProps {
  hideSubmitButton?: boolean;
  formId?: string;
  onSuccessCallback?: () => void;
}

export function CreateArtworkForm({ 
  setOpen, 
  initialData, 
  preventFreeze,
  hideSubmitButton = false,
  formId,
  onSuccessCallback
}: CreateArtworkFormProps) {
  const {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    handleImagesUploaded,
    isSaving,
    isAdmin,
    currentUserArtist
  } = useCreateArtworkForm({ 
    setOpen, 
    initialData, 
    preventFreeze,
    onSuccessCallback 
  });

  return (
    <CreateArtworkFormView
      form={form}
      classification={classification}
      artists={artists}
      locations={locations}
      handleImagesUploaded={handleImagesUploaded}
      initialData={initialData}
      onSubmit={onSubmit}
      isAdmin={isAdmin}
      currentUserArtist={currentUserArtist}
      hideSubmitButton={hideSubmitButton}
      formId={formId}
      isSaving={isSaving}
    />
  );
}
