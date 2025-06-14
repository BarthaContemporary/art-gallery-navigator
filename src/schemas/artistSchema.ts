
import { z } from 'zod';

export const representationStatusSchema = z.enum(["represented", "formerly represented", "not represented"]);

export const editArtistSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  surname_first_letter: z.string().max(1, "Sort letter must be a single character").optional().nullable().transform(val => val === "" ? null : val),
  email: z.string().email("Invalid email address").optional().nullable().transform(val => val === "" ? null : val),
  birth_year: z.number().int().min(1000, "Invalid year").max(new Date().getFullYear(), "Birth year cannot be in the future").optional().nullable(),
  death_year: z.number().int().min(1000, "Invalid year").max(new Date().getFullYear() + 100, "Invalid year").optional().nullable(),
  place_of_birth: z.string().optional().nullable().transform(val => val === "" ? null : val),
  place_of_death: z.string().optional().nullable().transform(val => val === "" ? null : val),
  nationality: z.string().optional().nullable().transform(val => val === "" ? null : val),
  biography: z.string().optional().nullable().transform(val => val === "" ? null : val),
  representation_status: representationStatusSchema.default("not represented"),
  image: z.instanceof(FileList).optional().nullable(),
});

export type EditArtistFormValues = z.infer<typeof editArtistSchema>;
