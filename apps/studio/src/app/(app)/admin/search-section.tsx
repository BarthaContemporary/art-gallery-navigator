/*
 * Admin → Search: the OpenSearch index beside Postgres. The engine's state,
 * each index's documents against the database's records with its last
 * reconcile, the changes waiting in search_outbox, the last update the drain
 * sent, and "Reconcile now" (the action is the page's, which checks the
 * session and the admin role itself).
 *
 * A server component the page renders for admins only; it checks the role
 * again before it touches the service client. The page streams it in under
 * Suspense (SearchSectionLoading), so a slow or unreachable search server,
 * whose status reads wait up to 5 s each, never holds up the rest.
 *
 * Works exactly as today before the server and migration 0100 exist:
 * searchStatus() answers "not configured" without OPENSEARCH_URL and
 * setUp: false without 0100, and never throws.
 */
import { createServiceClient, getSession, hasRole } from "@/lib/supabase";
import { searchConfig } from "@/lib/opensearch/config";
import { searchStatus, type SearchStatus, type StateRow } from "@/lib/opensearch/indexer";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
// London time: this renders on the server, where the zone is UTC.
import { formatDateTime } from "@/lib/format";
import { KIND_LABELS, engineWords, indexWords, pendingWords, resultWords, setupWarning } from "./search-words";

const TITLE = "Search";

/** The section's place while the status loads. */
export function SearchSectionLoading() {
  return (
    <Section title={TITLE}>
      <div role="status" className="space-y-2 py-1">
        <span className="sr-only">Loading</span>
        <Skeleton width="45%" />
        <Skeleton width="60%" />
        <Skeleton width="35%" />
      </div>
    </Section>
  );
}

/** "17 Nov 2026, 02:17: Done: 1234 indexed, …", or what is missing. */
function runText(row: StateRow | undefined, never: string): string {
  if (!row?.lastRunAt) return never;
  return `${formatDateTime(row.lastRunAt)}: ${resultWords(row.lastResult)}`;
}

export async function SearchSection({ reconcileAction }: { reconcileAction: () => Promise<void> }) {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) return null;

  const cfg = searchConfig(process.env);
  let status: SearchStatus | null = null;
  try {
    status = await searchStatus(createServiceClient(), cfg);
  } catch {
    status = null;
  }
  if (!status) {
    return (
      <Section title={TITLE} meta="The search status could not be read.">
        <p className="max-w-[65ch] text-[13px] leading-[1.45] text-body">
          Search itself is not affected: every search asks Postgres first. Reload the page to try again.
        </p>
      </Section>
    );
  }

  const engine = engineWords(status);
  const configured = cfg !== null;
  const setup = configured ? setupWarning(status) : null;
  const drain = status.state.drain;

  return (
    <Section
      title={TITLE}
      meta={engine.summary}
      actions={<Badge tone={engine.tone === "info" ? "neutral" : engine.tone}>{engine.label}</Badge>}
    >
      {engine.detail ? (
        <Notice tone="warn" className="mb-3">
          {engine.detail}
        </Notice>
      ) : null}
      {setup ? (
        <Notice tone="warn" className="mb-3">
          {setup}
        </Notice>
      ) : null}

      {configured ? (
        <p className="mb-3 max-w-[65ch] text-[13px] leading-[1.45] text-body">
          Every search in the studio asks Postgres; for admin and staff OpenSearch adds matches across fields and
          close spellings, merged in. Changes reach the index within seconds of a save, anything missed within 10
          minutes, and every night the index is checked against the database. Reconcile now runs that check at once,
          for example after the search server was rebuilt. It is safe to repeat.
        </p>
      ) : status.engine === "not configured" ? (
        <p className="max-w-[65ch] text-[13px] leading-[1.45] text-body">
          Every search works as it always has. To add OpenSearch, follow docs/ops/opensearch-runbook.md and set the
          OPENSEARCH_ variables on the studio&rsquo;s Vercel project.
        </p>
      ) : null}

      {configured ? (
        <>
          <ul className="divide-y divide-rule border-y border-rule">
            {status.indices.map((i) => {
              const words = indexWords(i);
              const last = status.state[i.kind];
              return (
                <li key={i.kind} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">{KIND_LABELS[i.kind]}</p>
                    <p className="break-words text-[12px] leading-[1.4] text-meta">
                      Last reconcile {runText(last, "not run yet")}
                    </p>
                    {last?.lastError ? (
                      <p className="break-words text-[12px] leading-[1.4] text-danger">{last.lastError}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="tabular text-[13px] text-body">{words.counts}</p>
                    {words.note ? (
                      <p className={`text-[12px] leading-[1.4] ${words.warn ? "text-warn" : "text-meta"}`}>{words.note}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px] leading-[1.45]">
            <dt className="text-meta">Waiting for the index</dt>
            <dd className="tabular text-body">{pendingWords(status)}</dd>
            <dt className="text-meta">Last update sent</dt>
            <dd className="min-w-0 break-words text-body">
              {runText(drain, "None yet")}
              {drain?.lastError ? <span className="block text-[12px] leading-[1.4] text-danger">{drain.lastError}</span> : null}
            </dd>
            {status.otherIndices.length ? (
              <>
                <dt className="text-meta">Older versions</dt>
                <dd className="min-w-0 break-words text-body">
                  {status.otherIndices.join(", ")} (deleted by the next reconcile of that kind)
                </dd>
              </>
            ) : null}
          </dl>

          <form action={reconcileAction} className="mt-4">
            <Button type="submit" pendingLabel="Reconciling…">
              Reconcile now
            </Button>
          </form>
          <p className="mt-2 max-w-[65ch] text-[12px] leading-[1.4] text-meta">
            Writes every work, maker and contact to the index again and removes what the database no longer has.
            It can take a minute or two; the result is shown at the top of this page.
          </p>
        </>
      ) : null}
    </Section>
  );
}
