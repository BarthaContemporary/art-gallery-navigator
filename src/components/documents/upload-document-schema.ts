
import { z } from "zod";

export const uploadFormSchema = z.object({
  file: z.instanceof(File, { message: "File is required" }),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  artwork_id: z.string().optional(),
  collection_id: z.string().optional(),
  artist_id: z.string().optional(),
}).refine((data) => {
  // Get the states of each entity selection
  const hasArtwork = !!data.artwork_id && data.artwork_id !== "_none";
  const hasCollection = !!data.collection_id && data.collection_id !== "_none";
  const hasArtist = !!data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
  
  // Count how many entities are selected
  const selectedCount = [hasArtwork, hasCollection, hasArtist].filter(Boolean).length;
  
  // We need exactly one entity to be selected
  return selectedCount === 1;
}, {
  message: "Document must be attached to exactly one of: artwork, collection, or artist",
  path: ["artwork_id", "collection_id", "artist_id"], 
});

export type UploadFormData = z.infer<typeof uploadFormSchema>;
