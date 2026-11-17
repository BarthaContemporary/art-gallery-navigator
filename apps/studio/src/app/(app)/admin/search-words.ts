/*
 * The words of Admin → Search: the search server's state, the queue, the
 * last runs and the outcome of "Reconcile now", in plain sentences. Pure
 * (formatCount aside), so search-words.test.ts runs it under node --test.
 *
 * Everything shown here comes from searchStatus() and reconcile()
 * (lib/opensearch/indexer.ts): statuses, counts, database codes and
 * OpenSearch error types. Never a document, a search term or an engine's
 * reason, which those never return.
 */
import { formatCount } from "@/lib/format";
import type { SearchKind } from "@/lib/opensearch/config";
import type { IndexStatus, ReconcileKindResult, ReconcileResult, SearchStatus } from "@/lib/opensearch/indexer";

export const KIND_LABELS: Record<SearchKind, string> = { works: "Works", makers: "Makers", contacts: "Contacts" };

export const NOT_CONFIGURED = "Search uses Postgres only (OpenSearch not configured).";
const NOT_SET_UP = "the database side of search (migration 0100) is not applied yet";
const RUNBOOK = "docs/ops/opensearch-runbook.md";

export type EngineWords = {
  /** "ok" running, "info" a normal state (not configured), "warn" needs the owner. */
  tone: "ok" | "info" | "warn";
  /** The state in a word or two, for a badge ("OK", "Not configured"). */
  label: string;
  /** One sentence for the section's meta line. */
  summary: string;
  /** What it means and what to do, for a notice under the heading. */
  detail: string | null;
};

/** The engine's state in plain words. */
export function engineWords(s: Pick<SearchStatus, "engine" | "health" | "problem">): EngineWords {
  const problem = s.problem ? `${s.problem.replace(/\.$/, "")}. ` : "";
  switch (s.engine) {
    case "not configured":
      return { tone: "info", label: "Not configured", summary: NOT_CONFIGURED, detail: null };
    case "misconfigured":
      return {
        tone: "warn",
        label: "Misconfigured",
        summary: "Search uses Postgres only: the OpenSearch settings cannot be used.",
        detail: `${problem}Check the OPENSEARCH_ variables on the studio's Vercel project (${RUNBOOK}).`,
      };
    case "unreachable":
      return {
        tone: "warn",
        label: "Unreachable",
        summary: "OpenSearch cannot be reached, so search uses Postgres only until it answers again.",
        detail: `${problem}Changes wait in the queue and follow once it is back. If it stays down, see ${RUNBOOK}.`,
      };
    case "disk-full":
      return {
        tone: "warn",
        label: "Disk nearly full",
        summary: "OpenSearch is running, but the search server's disk is nearly full.",
        detail: `No index can be created, so a reconcile cannot rebuild one. Searching and updates still work. Free space on the server (${RUNBOOK}).`,
      };
    case "read-only":
      return {
        tone: "warn",
        label: "Read-only",
        summary: "The search index is read-only: the search server's disk is full.",
        detail: `Searching still works, but changes no longer reach the index, so new and edited records are found through Postgres only. Free space on the server, then reconcile (${RUNBOOK}).`,
      };
    case "ok":
    default:
      if (s.health === "red") {
        return {
          tone: "warn",
          label: "Unhealthy",
          summary: "OpenSearch answers, but reports a problem (health red).",
          detail: `Some searches may fall back to Postgres. See ${RUNBOOK}.`,
        };
      }
      return { tone: "ok", label: "OK", summary: `OpenSearch is running beside Postgres${s.health ? ` (health ${s.health})` : ""}.`, detail: null };
  }
}

/** Shown when OpenSearch is configured but migration 0100 is missing: nothing reaches the index. */
export function setupWarning(s: Pick<SearchStatus, "setUp">): string | null {
  return s.setUp
    ? null
    : `The database side of search (migration 0100) is not applied yet: changes are not queued for the index, and a reconcile does nothing until it is.`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${formatCount(n)} ${n === 1 ? one : many}`;

/** The outbox: how many changes wait for the index. */
export function pendingWords(s: Pick<SearchStatus, "setUp" | "pending">): string {
  if (!s.setUp) return "Not set up (migration 0100 not applied)";
  if (s.pending === null) return "Not known (the count did not come back)";
  if (s.pending === 0) return "None";
  return plural(s.pending, "change");
}

const RESULT_LABELS: Record<string, string> = {
  ok: "Done",
  partial: "Partly done",
  failed: "Failed",
  blocked: "Blocked (disk nearly full)",
  "not set up": "Not set up",
};

/** A run's stored result ("ok: 5 claimed, 5 done, 0 left") with its status in words ("Done: 5 claimed, …"). */
export function resultWords(result: string | null): string {
  if (!result) return "No result recorded";
  const m = /^([a-z ]+):\s*(.*)$/s.exec(result);
  if (!m) return result;
  const label = RESULT_LABELS[m[1]!];
  return label ? (m[2] ? `${label}: ${m[2]}` : label) : result;
}

/** An index's documents against the database's records, and anything to note. */
export function indexWords(i: IndexStatus): { counts: string; note: string | null; warn: boolean } {
  const database = i.database === null ? "not known" : formatCount(i.database);
  if (!i.exists) {
    return { counts: `Not created · ${database} in the database`, note: "The next reconcile creates it.", warn: true };
  }
  const indexed = i.documents === null ? "not known" : formatCount(i.documents);
  const counts = `${indexed} indexed · ${database} in the database`;
  if (i.readOnly) return { counts, note: "Read-only (disk full)", warn: true };
  if (i.documents === null || i.database === null || i.documents === i.database) return { counts, note: null, warn: false };
  const gap = i.database - i.documents;
  // A few saves in flight are normal; the drain or the next reconcile closes the gap.
  return gap > 0
    ? { counts, note: `${plural(gap, "record")} not in the index yet`, warn: false }
    : { counts, note: `${plural(-gap, "document")} more than the database (removed at the next reconcile)`, warn: false };
}

function kindPart(k: ReconcileKindResult): string {
  const bits = [`${formatCount(k.indexed)} indexed`];
  if (k.removed) bits.push(`${formatCount(k.removed)} removed`);
  if (k.superseded) bits.push(`${formatCount(k.superseded)} already newer`);
  if (k.created) bits.push("index created");
  let part = `${KIND_LABELS[k.kind]}: ${bits.join(", ")}`;
  if (k.status === "blocked") part += `, stopped (disk nearly full${k.error ? `: ${k.error}` : ""})`;
  else if (k.status === "failed") part += `, failed${k.error ? ` (${k.error})` : ""}`;
  else if (k.error) part += ` (note: ${k.error})`;
  return part;
}

/** The notice "Reconcile now" leaves at the top of the page. */
export function reconcileNotice(r: ReconcileResult): string {
  if (r.status === "not configured") return `${NOT_CONFIGURED} There is nothing to reconcile.`;
  if (r.status === "not set up") return `Nothing reconciled: ${NOT_SET_UP}.`;
  const parts = r.kinds.map(kindPart).join("; ");
  if (r.status === "ok") return `Search index reconciled. ${parts}.`;
  if (r.status === "blocked") {
    return `Reconcile stopped: the search server's disk is nearly full. ${parts}. Searching still works; free space on the server and run it again (${RUNBOOK}).`;
  }
  return `Reconcile failed. ${parts}. Search still works through Postgres; try again, and see ${RUNBOOK} if it keeps failing.`;
}

/** The notice when reconcile() itself threw (it is written not to). */
export const RECONCILE_THREW = "Reconcile stopped on an unexpected error. Search still works through Postgres; try again.";
