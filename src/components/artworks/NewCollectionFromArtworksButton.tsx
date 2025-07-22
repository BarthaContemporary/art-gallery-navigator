
import { CreateCollectionFromArtworksDialog } from "./CreateCollectionFromArtworksDialog";
import type { Artwork } from "@/types/artwork";

interface NewCollectionFromArtworksButtonProps {
  filteredArtworks: Artwork[];
}

export function NewCollectionFromArtworksButton({ filteredArtworks }: NewCollectionFromArtworksButtonProps) {
  return (
    <CreateCollectionFromArtworksDialog filteredArtworks={filteredArtworks} />
  );
}
