import type { createServiceClient } from "@jvb/db/server";
import { exactLikePattern } from "@/lib/form-fields";

type Service = ReturnType<typeof createServiceClient>;

/**
 * The contact behind an address typed into a public form: exactly that
 * address, ignoring case, the oldest contact when it is on more than one
 * (contact_id_by_email(), migration 0095). The routes used to match with
 * ILIKE and the typed address as the pattern, where "_" stands for any
 * character, so john_smith@ could land on john.smith@'s record (security
 * review 2026-10, F23).
 *
 * Until 0095 is on the database the function is missing; the same exact
 * match is then made with every ILIKE wildcard escaped, so a deploy that
 * reaches the website before the migration still finds the right contact.
 */
export async function contactIdByEmail(supabase: Service, email: string): Promise<string | null> {
  const address = email.trim();
  if (!address) return null;
  const { data, error } = await supabase.rpc("contact_id_by_email", { _email: address });
  if (!error) return typeof data === "string" ? data : null;
  console.error(`[contacts] contact_id_by_email unavailable (${error.message}); matching with an escaped ILIKE`);
  const { data: rows, error: fallbackError } = await supabase
    .from("crm_contacts")
    .select("id")
    .ilike("email", exactLikePattern(address))
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  if (fallbackError) throw fallbackError;
  return ((rows ?? [])[0] as { id: string } | undefined)?.id ?? null;
}
