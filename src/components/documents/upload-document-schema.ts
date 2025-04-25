
import { z } from "zod";

export const uploadFormSchema = z.object({
  file: z.instanceof(File, { message: "File is required" }),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  artwork_id: z.string().optional(),
  collection_id: z.string().optional(),
  artist_id: z.string().optional(),
}).refine((data) => {
  // Ensure only one of artwork_id or collection_id is set
  const hasArtwork = !!data.artwork_id;
  const hasCollection = !!data.collection_id;
  return (!hasArtwork && !hasCollection) || (hasArtwork !== hasCollection);
}, {
  message: "Document must be attached to either an artwork or a collection, not both",
});

export type UploadFormData = z.infer<typeof uploadFormSchema>;
