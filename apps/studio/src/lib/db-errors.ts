/**
 * True when a PostgREST error says the database function does not exist (yet):
 * the code went live before the migration that adds it. Only for features
 * that are safe to run without the function for that short window; anything
 * else must fail.
 */
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}
