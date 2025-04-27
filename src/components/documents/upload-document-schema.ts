
import { z } from "zod";

export const uploadFormSchema = z.object({
  file: z.instanceof(File, { message: "File is required" }),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  artwork_id: z.string().optional(),
  collection_id: z.string().optional(),
  artist_id: z.string().optional(),
}).refine((data) => {
  // Count how many of the entity fields are selected
  const hasArtwork = data.artwork_id && data.artwork_id !== "_none";
  const hasCollection = data.collection_id && data.collection_id !== "_none";
  const hasArtist = data.artist_id && data.artist_id !== "_none" && data.artist_id !== "";
  
  // Valid if exactly one entity is selected
  const selectedCount = [hasArtwork, hasCollection, hasArtist].filter(Boolean).length;
  return selectedCount === 1;
}, {
  message: "Document must be attached to exactly one of: artwork, collection, or artist",
  path: ["artwork_id"], // Path to show the error
});

export type UploadFormData = z.infer<typeof uploadFormSchema>;
