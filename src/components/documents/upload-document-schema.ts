
import { z } from "zod";

export const uploadFormSchema = z.object({
  file: z.instanceof(File, { message: "File is required" }),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  artwork_id: z.string().optional(),
  collection_id: z.string().optional(),
  artist_id: z.string().optional(),
}).refine((data) => {
  // Count the number of selected entities
  let selectedCount = 0;
  
  if (data.artwork_id && data.artwork_id !== "_none") selectedCount++;
  if (data.collection_id && data.collection_id !== "_none") selectedCount++;
  if (data.artist_id && data.artist_id !== "_none" && data.artist_id !== "") selectedCount++;
  
  // We need exactly one entity to be selected
  return selectedCount === 1;
}, {
  message: "Document must be attached to exactly one of: artwork, collection, or artist",
  path: ["artwork_id"], // Path to show the error
});

export type UploadFormData = z.infer<typeof uploadFormSchema>;
