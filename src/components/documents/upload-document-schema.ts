
import { z } from "zod";

export const uploadFormSchema = z.object({
  file: z.instanceof(File),
  type: z.string().min(1, "Document type is required"),
  description: z.string().optional(),
  artwork_id: z.string().optional(),
  artist_id: z.string().optional(),
});

export type UploadFormData = z.infer<typeof uploadFormSchema>;
