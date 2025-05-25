
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkFormData } from "./types";
import { Artist } from "@/hooks/useArtists"; // Import Artist type

export const getArtworkInitialValues = (
  initialData?: Artwork,
  isAdmin?: boolean,
  currentUserArtist?: Artist | null
): ArtworkFormData => {
  const defaultArtistId = (!isAdmin && currentUserArtist) ? currentUserArtist.id : initialData?.artist_id || "";

  return {
    title: initialData?.title || "",
    artist_id: defaultArtistId,
    year: initialData?.year || null,
    medium_type: initialData?.medium_type || "Painting",
    materials: initialData?.materials || "",
    classification: initialData?.classification || "Unique",
    edition_size: initialData?.edition_size || null,
    available_works: initialData?.available_works || "",
    artist_proofs: initialData?.artist_proofs || null,
    dimensions: initialData?.dimensions || "",
    height: initialData?.height || null,
    width: initialData?.width || null,
    depth: initialData?.depth || null,
    price: initialData?.price || null,
    currency: initialData?.currency || "USD",
    status: initialData?.status || "available",
    image_url: initialData?.image_url || "", // This is for the uploader, not a direct field
    location_id: initialData?.location_id || null,
    inventory_quantity: initialData?.inventory_quantity || null,
    signature_type: initialData?.signature_type || null,
    condition: initialData?.condition || "",
    signature_details: initialData?.signature_details || "",
    provenance: initialData?.provenance || "",
    story: initialData?.story || "",
    exhibition_history: initialData?.exhibition_history || "",
    is_framed: initialData?.is_framed || false,
    frame_height: initialData?.frame_height || null,
    frame_width: initialData?.frame_width || null,
    frame_depth: initialData?.frame_depth || null,
    weight: initialData?.weight || null,
    has_crate: initialData?.has_crate || false,
    crate_height: initialData?.crate_height || null,
    crate_width: initialData?.crate_width || null,
    crate_depth: initialData?.crate_depth || null,
  };
};
