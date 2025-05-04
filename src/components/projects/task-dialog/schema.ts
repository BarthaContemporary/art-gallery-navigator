
import * as z from "zod";

export const taskFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "scheduled", "completed", "abandoned"]),
  assigned_to: z.string().optional(),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
  project_id: z.string().min(1, "Project ID is required"),
});
