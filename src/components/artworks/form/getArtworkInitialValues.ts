
import { Artwork } from "@/hooks/use-artworks";
import { ArtworkFormData } from "./types";

export function getArtworkInitialValues(initialData?: Artwork): ArtworkFormData {
  const currencyValue =
    initialData?.currency && ["USD", "GBP", "EUR", "CHF"].includes(initialData.currency)
      ? initialData.currency as ArtworkFormData["currency"]
      : "USD";

  const signatureTypeValue =
    initialData?.signature_type &&
    [
      "not signed",
      "hand-signed by artist",
      "signed on plate",
      "stamped by artist's estate",
      "sticker label",
      "other"
    ].includes(initialData.signature_type)
      ? initialData.signature_type as ArtworkFormData["signature_type"]
      : "not signed";

  const mediumTypeValue =
    initialData?.medium_type &&
    [
      "Painting",
      "Sculpture", 
      "Photography", 
      "Work on Paper", 
      "Installation", 
      "Video", 
      "Textile Arts", 
      "Book"
    ].includes(initialData.medium_type)
      ? initialData.medium_type as ArtworkFormData["medium_type"]
      : "Painting";

  const classificationValue =
    initialData?.classification &&
    [
      "Unique", 
      "Limited Edition", 
      "Open Edition", 
      "Unknown Edition"
    ].includes(initialData.classification)
      ? initialData.classification as ArtworkFormData["classification"]
      : "Unique";

  return {
    title: initialData?.title || "",
    artist_id: initialData?.artist_id || "",
    year: initialData?.year || undefined,
    medium_type: mediumTypeValue,
    materials: initialData?.materials || "",
    classification: classificationValue,
    edition_size: initialData?.edition_size || undefined,
    dimensions: initialData?.dimensions || "",
    price: initialData?.price || undefined,
    currency: currencyValue,
    inventory_quantity: initialData?.inventory_quantity || undefined,
    available_works: initialData?.available_works || "",
    artist_proofs: initialData?.artist_proofs || undefined,
    height: initialData?.height || undefined,
    width: initialData?.width || undefined,
    depth: initialData?.depth || undefined,
    is_framed: initialData?.is_framed ?? false,
    frame_height: initialData?.frame_height || undefined,
    frame_width: initialData?.frame_width || undefined,
    frame_depth: initialData?.frame_depth || undefined,
    weight: initialData?.weight || undefined,
    has_crate: initialData?.has_crate ?? false,
    crate_height: initialData?.crate_height || undefined,
    crate_width: initialData?.crate_width || undefined,
    crate_depth: initialData?.crate_depth || undefined,
    location_id: initialData?.location_id || "",
    status: initialData?.status || 'available',
    image_url: initialData?.image_url || "",
    condition: initialData?.condition || "",
    signature_type: signatureTypeValue,
    signature_details: initialData?.signature_details || "",
    provenance: initialData?.provenance || "",
    story: initialData?.story || "",
    exhibition_history: initialData?.exhibition_history || ""
  };
}
