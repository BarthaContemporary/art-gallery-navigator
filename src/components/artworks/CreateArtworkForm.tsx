
import { CreateArtworkFormView } from "./form/CreateArtworkFormView";
import { useCreateArtworkForm } from "./form/useCreateArtworkForm";
import { Artwork } from "@/hooks/use-artworks";

interface CreateArtworkFormProps {
  setOpen: (open: boolean) => void;
  initialData?: Artwork;
  preventFreeze?: boolean;
}

export function CreateArtworkForm({ setOpen, initialData, preventFreeze = false }: CreateArtworkFormProps) {
  const {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    handleImagesUploaded,
    initialData: _initialData,
  } = useCreateArtworkForm({ 
    setOpen, 
    initialData, 
    preventFreeze 
  });

  return (
    <CreateArtworkFormView
      form={form}
      classification={classification}
      artists={artists}
      locations={locations}
      handleImagesUploaded={handleImagesUploaded}
      initialData={_initialData}
      onSubmit={onSubmit}
    />
  );
}
