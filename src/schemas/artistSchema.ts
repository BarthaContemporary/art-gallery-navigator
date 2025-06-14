
import { z } from 'zod';

export const representationStatusSchema = z.enum(["represented", "formerly represented", "not represented"]);

export const editArtistSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  surname_first_letter: z.string().max(1, "Sort letter must be a single character").optional().nullable().transform(val => val === "" ? null : val),
  email: z.string().email("Invalid email address").optional().nullable().transform(val => val === "" ? null : val),
  birth_year: z.number().int().min(1000, "Invalid year").max(new Date().getFullYear(), "Birth year cannot be in the future").optional().nullable(),
  death_year: z.number().int().min(1000, "Invalid year").max(new Date().getFullYear() + 100, "Invalid year").optional().nullable()
    .refine(
      (data) => (data === null || data === undefined), // Allow if death_year is not set
      { message: "Death year must be greater than birth year" } // This refine will be part of a superRefine on the whole schema later if needed
    ),
  place_of_birth: z.string().optional().nullable().transform(val => val === "" ? null : val),
  place_of_death: z.string().optional().nullable().transform(val => val === "" ? null : val),
  nationality: z.string().optional().nullable().transform(val => val === "" ? null : val),
  biography: z.string().optional().nullable().transform(val => val === "" ? null : val),
  representation_status: representationStatusSchema.default("not represented"),
  image: z.instanceof(FileList).optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.birth_year && data.death_year && data.death_year < data.birth_year) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Death year cannot be before birth year",
      path: ["death_year"],
    });
  }
});

export type EditArtistFormValues = z.infer<typeof editArtistSchema>;
