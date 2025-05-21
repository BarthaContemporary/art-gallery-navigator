
import * as z from "zod";

export const ProjectFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "scheduled", "completed", "abandoned"]),
  type: z.enum(["exhibition", "fair", "publication", "talk", "other"]),
  location_id: z.string().optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  // The 'users' field is removed from here as it's handled by 'user_emails' separately
});

