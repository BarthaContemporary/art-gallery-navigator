
import { z } from "zod";

export const uploadFormSchema = z.object({
  file: z.instanceof(File, { message: "File is required" }),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  artwork_id: z.string().optional(),
  collection_id: z.string().optional(),
  artist_id: z.string().optional(),
}).refine((data) => {
  // Ensure exactly one of artwork_id or collection_id is set
  const hasArtwork = !!data.artwork_id && data.artwork_id !== "_none";
  const hasCollection = !!data.collection_id && data.collection_id !== "_none";
  
  // We need exactly one of them to be true
  return (hasArtwork && !hasCollection) || (!hasArtwork && hasCollection);
}, {
  message: "Document must be attached to either an artwork or a collection, not both or neither",
  path: ["artwork_id", "collection_id"], // This highlights both fields when validation fails
});

export type UploadFormData = z.infer<typeof uploadFormSchema>;
