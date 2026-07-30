import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/chunk";

/*
 * One implementation of "who is in this contact list".
 *
 * A list is either curated (rows in crm_list_members) or dynamic (membership
 * computed from filter_rules, no rows at all). Every surface that reads a list
 * — labels, vCards, campaigns, offers, the list pages — goes through here.
 *
 * The alternative is what inventory lists did before `lib/list-members.ts`:
 * each route counted members its own way, dynamic lists reported zero in some
 * views and not others, and it took a bug report to notice. Same trap, so the
 * same fix, pre-emptively.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, "public", any>;

export type CrmFilterRules = {
  contact_type?: string | null;
  country?: string | null;
  /** Narrow to contacts who have (or have not) opted in to marketing. */
  marketing_consent?: boolean | null;
  /**
   * An area of interest, matched against the contact's own
   * custom_fields.interests array — the same array the contact editor writes.
   * This is what makes the areas-of-interest lists live.
   */
  interest?: string | null;
};

export type CrmListLike = {
  id: string;
  is_dynamic?: boolean | null;
  filter_rules?: unknown;
};

function rulesOf(list: CrmListLike): CrmFilterRules {
  return (list.filter_rules ?? {}) as CrmFilterRules;
}

/**
 * Apply a dynamic list's rules to a crm_contacts query.
 *
 * No rules at all is the "All" case and deliberately adds no filter — every
 * contact is a member. That is the one shape worth being explicit about,
 * because an accidental `.eq(col, undefined)` would silently return nothing.
 */
type RuleBuilder = {
  eq: (column: string, value: unknown) => RuleBuilder;
  contains: (column: string, value: unknown) => RuleBuilder;
};

function applyRules(query: unknown, rules: CrmFilterRules): unknown {
  let q = query as RuleBuilder;
  if (rules.contact_type) q = q.eq("contact_type", rules.contact_type);
  if (rules.country) q = q.eq("country", rules.country);
  if (typeof rules.marketing_consent === "boolean") {
    q = q.eq("marketing_consent", rules.marketing_consent);
  }
  if (rules.interest) {
    // jsonb array containment on the path: custom_fields->interests=cs.["X"].
    // Verified against the live API before relying on it; backed by the GIN
    // index added in 0060.
    q = q.contains("custom_fields->interests", [rules.interest]);
  }
  return q;
}

/** True when this list's membership is computed rather than curated. */
export function isDynamic(list: CrmListLike): boolean {
  return Boolean(list.is_dynamic);
}

/**
 * Load the contacts in a list with whichever columns the caller needs.
 *
 * Prefer this over resolving ids and re-querying: for a dynamic list it is a
 * single filtered read of crm_contacts, and for a curated one the id set is
 * chunked, so a list of several hundred people cannot blow the URL length
 * limit the way inventory lists did.
 */
export async function loadListContacts<T extends { id: string }>(
  supabase: Db,
  list: CrmListLike,
  columns: string,
): Promise<T[]> {
  if (isDynamic(list)) {
    const { data, error } = (await applyRules(
      supabase.from("crm_contacts").select(columns),
      rulesOf(list),
    )) as { data: T[] | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data: rows, error } = await supabase
    .from("crm_list_members")
    .select("contact_id")
    .eq("list_id", list.id);
  if (error) throw new Error(error.message);

  const ids = ((rows ?? []) as { contact_id: string }[]).map((r) => r.contact_id);
  if (ids.length === 0) return [];

  return selectInChunks<T>(
    ids,
    (chunk) =>
      supabase.from("crm_contacts").select(columns).in("id", chunk) as unknown as PromiseLike<{
        data: T[] | null;
        error: { message: string } | null;
      }>,
  );
}

/** Member ids only — for membership checks and "is this contact in that list". */
export async function resolveListContactIds(
  supabase: Db,
  list: CrmListLike,
): Promise<string[]> {
  const rows = await loadListContacts<{ id: string }>(supabase, list, "id");
  return rows.map((r) => r.id);
}

/**
 * How many people are in this list.
 *
 * A head-count query rather than fetching rows, and it must never be replaced
 * by `crm_list_members(count)`: that embed returns 0 for every dynamic list,
 * which is precisely the bug this module exists to prevent.
 */
export async function countListMembers(
  supabase: Db,
  list: CrmListLike,
): Promise<number> {
  if (isDynamic(list)) {
    const { count } = (await applyRules(
      supabase.from("crm_contacts").select("id", { count: "exact", head: true }),
      rulesOf(list),
    )) as { count: number | null };
    return count ?? 0;
  }
  // Count contacts that actually resolve, not membership rows.
  //
  // crm_list_members.contact_id cascades on delete, so today the two agree.
  // But counting rows is the same mistake as the inventory list that said 425
  // and showed nothing: the number comes from one place and the contents from
  // another, and any divergence is invisible until someone reports it. Deriving
  // both from the same read means a stale or orphaned row cannot inflate a
  // count, and a deleted contact leaves a list the moment it is deleted.
  const rows = await loadListContacts<{ id: string }>(supabase, list, "id");
  return rows.length;
}

/** Counts for many lists at once, for index pages. */
export async function countMembersForLists(
  supabase: Db,
  lists: CrmListLike[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  await Promise.all(
    lists.map(async (l) => {
      out.set(l.id, await countListMembers(supabase, l));
    }),
  );
  return out;
}

/** Human summary of a dynamic list's rules, for the UI. */
export function describeRules(list: CrmListLike): string {
  const r = rulesOf(list);
  const parts = [
    r.interest ? `interested in ${r.interest}` : null,
    r.contact_type ? `type ${r.contact_type}` : null,
    r.country ? `in ${r.country}` : null,
    typeof r.marketing_consent === "boolean"
      ? r.marketing_consent
        ? "opted in to marketing"
        : "not opted in to marketing"
      : null,
  ].filter(Boolean);
  return parts.length === 0 ? "every contact" : parts.join(", ");
}
