
import { CreateArtworkFormView } from "./form/CreateArtworkFormView";
import { useCreateArtworkForm } from "./form/useCreateArtworkForm";
import { Artwork } from "@/hooks/use-artworks";

interface CreateArtworkFormProps {
  setOpen: (open: boolean) => void;
  initialData?: Artwork;
}

export function CreateArtworkForm({ setOpen, initialData }: CreateArtworkFormProps) {
  const {
    form,
    classification,
    artists,
    locations,
    onSubmit,
    handleImagesUploaded,
    initialData: _initialData,
  } = useCreateArtworkForm({ setOpen, initialData });

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
