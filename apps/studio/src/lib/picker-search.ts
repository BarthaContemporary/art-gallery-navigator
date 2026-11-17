/*
 * The "find works to add" and "find contacts to add" boxes on record pages
 * (offers, documents, shipments). Server only: it goes through
 * lib/opensearch/search.ts, which holds the engine's credentials.
 *
 * Each box asks searchWorkIds / searchContactIds for ranked ids (Postgres
 * always, OpenSearch merged in for admin and staff, the typo-tolerant pass
 * when nothing matched exactly), takes out what the record already holds,
 * and loads the rows through the caller's own client, so row level security
 * decides what is shown and every string on screen comes from those rows:
 * works from vw_pieces_list (never vw_pieces_all, which includes the trash),
 * contacts from crm_contacts. Ids that do not load are dropped and the next
 * ones are tried, so a stale index never leaves the box short.
 *
 * With OpenSearch unconfigured, down or behind, the boxes show what they
 * showed before it existed: pieces_search's and crm_contacts_search's order,
 * the records already added taken out, the first 20.
 *
 * Errors are returned, never thrown, so each page keeps its own handling.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectInChunks } from "@/lib/chunk";
import type { PieceSummary } from "@/lib/piece-store";
import { inOrder, searchContactIds, searchWorkIds, type Roles } from "@/lib/opensearch/search";

type Db = SupabaseClient;

/** Rows a box shows. */
export const PICKER_SHOW = 20;
/** The time a page gives the search (the palette's is 600 ms). */
export const PICKER_TIMEOUT_MS = 1500;

/**
 * How many ids to ask for: the rows shown, the ones the record already has
 * (they are taken out after ranking) and a margin for ids that will not
 * load. OpenSearch returns ids only, so a wide window costs little.
 */
const PICKER_MARGIN = 40;
const PICKER_MAX_IDS = 1000;
/** Ids loaded per round, and the most a box looks at before it settles for fewer rows. */
const LOAD_WINDOW = 50;
const LOAD_MAX = 200;

/** The work columns the boxes show (PieceSummary, as loadPieceSummaries gives it, from the live view). */
const WORK_COLUMNS = "id, stock_number, title, medium, period, status, year, maker_name, ledger";

export type PickedContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  salutation: string | null;
  email: string | null;
  unsubscribed_at: string | null;
  email_bounced_at: string | null;
};
const CONTACT_COLUMNS = "id, first_name, last_name, salutation, email, unsubscribed_at, email_bounced_at";

export type Picked<Row> = {
  rows: Row[];
  /** The rows are the typo-tolerant pass's: say "Similar matches" over them. */
  similar: boolean;
  /** The search's or the row load's error, in supabase-js's shape; rows are then empty. */
  error: { message: string } | null;
};

export type PickOptions = {
  /** From the session the page already read (getSession is not called here). */
  roles: Roles;
  /** Ids already on the record: never offered again. */
  exclude?: ReadonlySet<string>;
  show?: number;
  timeoutMs?: number;
};

const idWindow = (show: number, exclude: ReadonlySet<string>) =>
  Math.min(PICKER_MAX_IDS, show + exclude.size + PICKER_MARGIN);

/**
 * The first `show` rows of `ids` that `load` returns, in the order of `ids`,
 * loading a window at a time until enough have loaded or LOAD_MAX ids were
 * tried. `load` throws on a failed read (selectInChunks does).
 */
async function firstLoadable<Row extends { id: string }>(
  ids: readonly string[],
  show: number,
  load: (ids: string[]) => Promise<Row[]>,
): Promise<Row[]> {
  const out: Row[] = [];
  for (let at = 0; at < ids.length && at < LOAD_MAX && out.length < show; at += LOAD_WINDOW) {
    const window = ids.slice(at, Math.min(at + LOAD_WINDOW, LOAD_MAX));
    out.push(...inOrder(window, await load(window)));
  }
  return out.slice(0, show);
}

const failed = (e: unknown) => ({ message: e instanceof Error ? e.message : "The rows could not be loaded" });

/** Works matching `q` that are not on the record yet, best first. */
export async function pickWorks(supabase: Db, q: string, opts: PickOptions): Promise<Picked<PieceSummary>> {
  const exclude = opts.exclude ?? new Set<string>();
  const show = opts.show ?? PICKER_SHOW;
  const found = await searchWorkIds(supabase, q, {
    roles: opts.roles,
    size: idWindow(show, exclude),
    timeoutMs: opts.timeoutMs ?? PICKER_TIMEOUT_MS,
    fuzzy: true,
  });
  if (found.error) return { rows: [], similar: false, error: found.error };
  const ids = found.ids.filter((id) => !exclude.has(id));
  try {
    const rows = await firstLoadable(ids, show, (window) =>
      selectInChunks<PieceSummary>(window, (chunk) =>
        supabase.from("vw_pieces_list").select(WORK_COLUMNS).in("id", chunk) as unknown as PromiseLike<{
          data: PieceSummary[] | null;
          error: { message: string } | null;
        }>,
      ),
    );
    return { rows, similar: found.similar && rows.length > 0, error: null };
  } catch (e) {
    return { rows: [], similar: false, error: failed(e) };
  }
}

/**
 * Contacts matching `q` that are not on the record yet, best first. An
 * erased contact is never offered: it has nothing left to send to, and an
 * index entry that outlived its erasure must not put the record on screen
 * under a search for the old name.
 */
export async function pickContacts(supabase: Db, q: string, opts: PickOptions): Promise<Picked<PickedContact>> {
  const exclude = opts.exclude ?? new Set<string>();
  const show = opts.show ?? PICKER_SHOW;
  const found = await searchContactIds(supabase, q, {
    roles: opts.roles,
    limit: idWindow(show, exclude),
    timeoutMs: opts.timeoutMs ?? PICKER_TIMEOUT_MS,
    fuzzy: true,
  });
  if (found.error) return { rows: [], similar: false, error: found.error };
  const ids = found.ids.filter((id) => !exclude.has(id));
  try {
    const rows = await firstLoadable(ids, show, (window) =>
      selectInChunks<PickedContact>(window, (chunk) =>
        supabase.from("crm_contacts").select(CONTACT_COLUMNS).in("id", chunk).is("erased_at", null) as unknown as PromiseLike<{
          data: PickedContact[] | null;
          error: { message: string } | null;
        }>,
      ),
    );
    return { rows, similar: found.similar && rows.length > 0, error: null };
  } catch (e) {
    return { rows: [], similar: false, error: failed(e) };
  }
}
