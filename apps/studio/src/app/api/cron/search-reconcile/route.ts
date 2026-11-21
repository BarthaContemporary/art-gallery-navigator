import { createServiceClient } from "@jvb/db/server";
import { searchConfig } from "@/lib/opensearch/config";
import { reconcileFromCron } from "@/lib/search-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Nightly reconcile of the search indices (vercel.json, 02:17 UTC): for
 * works, makers and contacts in turn, create the current version's index if
 * it is missing, write every record at the database clock, remove what the
 * database no longer has, delete lower versions, and on contacts merge away
 * deleted documents (which bounds how long erased data stays on disk). The
 * same as Admin → Search → Reconcile now. See lib/opensearch/indexer.ts.
 *
 * Auth: CRON_SECRET bearer header only, as the other crons. OpenSearch not
 * configured: 200 { skipped }. Migration 0100 absent: 200 { skipped: "not set up" }.
 */
export async function GET(request: Request) {
  return reconcileFromCron(request, { service: createServiceClient, cfg: searchConfig(process.env), env: process.env });
}
