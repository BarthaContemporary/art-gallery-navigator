import { createServiceClient } from "@jvb/db/server";
import { searchConfig } from "@/lib/opensearch/config";
import { drainFromCron, drainFromDatabase, type RouteDeps } from "@/lib/search-routes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Eight rounds of 200 outbox rows, a self-heal among them (lib/search-routes.ts). */
export const maxDuration = 300;

/**
 * Supabase → OpenSearch: drains search_outbox (migration 0100). Woken by the
 * database once per committing transaction that changed something indexed
 * (POST, x-sync-secret from sync_config, as /api/sync/sanity), and every 10
 * minutes by the Vercel cron (GET, CRON_SECRET) for anything a wake-up
 * missed. Each claimed record is read again from the database and written
 * (or removed) at the claim's version; see lib/opensearch/indexer.ts.
 *
 * OpenSearch not configured: the rows are claimed and discarded. Migration
 * 0100 absent: 200 { skipped: "not set up" }.
 */
function deps(): RouteDeps {
  return { service: createServiceClient, cfg: searchConfig(process.env), env: process.env };
}

export async function POST(request: Request) {
  return drainFromDatabase(request, deps());
}

export async function GET(request: Request) {
  return drainFromCron(request, deps());
}
