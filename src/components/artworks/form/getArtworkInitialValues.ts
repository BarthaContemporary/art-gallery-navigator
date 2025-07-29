
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkFormData } from "./types";
import { Artist } from "@/hooks/useArtists"; // Import Artist type

const artworkClassifications: ArtworkFormData['classification'][] = ['Unique', 'Limited Edition', 'Open Edition', 'Unknown Edition'];

export const getArtworkInitialValues = (
  initialData?: Artwork,
  isAdmin?: boolean,
  currentUserArtist?: Artist | null
): ArtworkFormData => {
  const defaultArtistId = (!isAdmin && currentUserArtist) ? currentUserArtist.id : initialData?.artist_id || "";

  const initialClassification = initialData?.classification;
  const validatedClassification =
    initialClassification && artworkClassifications.includes(initialClassification as ArtworkFormData['classification'])
      ? (initialClassification as ArtworkFormData['classification'])
      : 'Unique';

  return {
    title: initialData?.title || "",
    artist_id: defaultArtistId,
    year: initialData?.year || 0,
    medium_type: (initialData?.medium_type as any) || "Painting",
    materials: initialData?.materials || "",
    classification: validatedClassification,
    edition_size: initialData?.edition_size || 0,
    available_works: initialData?.available_works || "",
    artist_proofs: initialData?.artist_proofs || 0,
    dimensions: initialData?.dimensions || "",
    height: initialData?.height || 0,
    width: initialData?.width || 0,
    depth: initialData?.depth || 0,
    price: initialData?.price || 0,
    currency: (initialData?.currency as any) || "USD",
    status: initialData?.status || "available",
    image_url: initialData?.image_url || "",
    location_id: initialData?.location_id || "",
    inventory_quantity: initialData?.inventory_quantity || 0,
    signature_type: (initialData?.signature_type as any) || "not signed",
    condition: initialData?.condition || "",
    signature_details: initialData?.signature_details || "",
    additional_keywords: initialData?.additional_keywords || "",
    provenance: initialData?.provenance || "",
    story: initialData?.story || "",
    exhibition_history: initialData?.exhibition_history || "",
    ai_description: initialData?.ai_description || "",
    is_framed: initialData?.is_framed || false,
    frame_height: initialData?.frame_height || 0,
    frame_width: initialData?.frame_width || 0,
    frame_depth: initialData?.frame_depth || 0,
    weight: initialData?.weight || 0,
    has_crate: initialData?.has_crate || false,
    crate_height: initialData?.crate_height || 0,
    crate_width: initialData?.crate_width || 0,
    crate_depth: initialData?.crate_depth || 0,
  };
};
