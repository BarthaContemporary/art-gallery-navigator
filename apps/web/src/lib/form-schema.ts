import { z } from "zod";
import { ONE_LINE, ONE_LINE_MESSAGE, siteLine, typedLine } from "@/lib/form-fields";

/*
 * The single-line rules of lib/form-fields as zod schemas, for the public
 * form routes. Each takes the field's own string schema (length limits,
 * messages, .email()) and runs it after the tidying.
 */

/**
 * A field the visitor types: tabs and line separators become spaces, then
 * a line break or other control character is refused with a message that
 * says why.
 *
 *   name: oneLine(z.string().trim().min(1, "Please enter your name").max(200))
 */
export function oneLine(field: z.ZodString) {
  return z.string().transform(typedLine).pipe(field.regex(ONE_LINE, ONE_LINE_MESSAGE));
}

/**
 * A value the site fills in itself from catalogue data (an enquiry's
 * subject, a work's key): line breaks become spaces instead of refusing an
 * enquiry the visitor could not put right.
 */
export function siteText(field: z.ZodString) {
  return z.string().transform(siteLine).pipe(field);
}
