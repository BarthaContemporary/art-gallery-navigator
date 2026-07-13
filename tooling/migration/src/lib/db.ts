import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for the DB-dependent commands
 * (load-raw, import-mappings, finalize). Offline commands never call this.
 */
export function getSupabase(): SupabaseClient {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    console.error(
      [
        "This command needs database access.",
        "Set both environment variables and retry:",
        "  SUPABASE_URL                 e.g. https://api.example.com",
        "  SUPABASE_SERVICE_ROLE_KEY    service-role key (server-side only, never commit)",
      ].join("\n"),
    );
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Split an array into chunks of `size` for batched inserts. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
