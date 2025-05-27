
import { z } from "zod";

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long. For better security, include uppercase, lowercase, numbers, and special characters."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;
