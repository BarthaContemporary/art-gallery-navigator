import type { core } from "zod";

/*
 * The wording of the public form routes' refusals (app/api/enquiry,
 * booking, newsletter), kept as it was under Zod 3. Each route sends the
 * first issue's message back and the form shows it to the visitor, so a
 * name, phone number or message that is too long, an address Zod refuses
 * ("jane@gallery" passes the browser's own check) or a hand-made request
 * reads the same as before Zod 4, whose default wording differs ("Too big:
 * expected string to have <=3000 characters" for "String must contain at
 * most 3000 character(s)").
 *
 * Passed as the parse-level error map, `schema.safeParse(body, { error:
 * zod3Wording })`. A message the schema sets itself ("Please enter your
 * name") still wins over it; anything not covered here gets Zod 4's own
 * wording. Kept free of Next and path aliases so `node --test` can run
 * form-messages.test.ts against this file directly.
 */

const listed = (values: readonly unknown[]) =>
  values.map((v) => (typeof v === "string" ? `'${v}'` : String(v))).join(" | ");

/** Zod 3's name for the kind of value sent (a request body is JSON). */
function kindOf(input: unknown): string {
  if (input === null) return "null";
  if (Array.isArray(input)) return "array";
  if (typeof input === "number" && Number.isNaN(input)) return "nan";
  return typeof input;
}

export const zod3Wording: core.$ZodErrorMap = (issue) => {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined ? "Required" : `Expected ${issue.expected}, received ${kindOf(issue.input)}`;
    case "invalid_value": {
      const def = issue.inst?._zod.def as { type?: string } | undefined;
      if (def?.type === "literal") return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`;
      if (def?.type !== "enum") return undefined;
      if (issue.input === undefined) return "Required";
      if (typeof issue.input !== "string") return `Expected ${listed(issue.values)}, received ${kindOf(issue.input)}`;
      return `Invalid enum value. Expected ${listed(issue.values)}, received '${issue.input}'`;
    }
    case "too_small":
      if (issue.origin !== "string") return undefined;
      return `String must contain ${issue.exact ? "exactly" : issue.inclusive ? "at least" : "over"} ${issue.minimum} character(s)`;
    case "too_big":
      if (issue.origin !== "string") return undefined;
      return `String must contain ${issue.exact ? "exactly" : issue.inclusive ? "at most" : "under"} ${issue.maximum} character(s)`;
    case "invalid_format":
      if (issue.format === "regex") return "Invalid";
      if (issue.format === "email") return "Invalid email";
      if (issue.format === "uuid" || issue.format === "guid") return "Invalid uuid";
      return undefined;
    default:
      return undefined;
  }
};
