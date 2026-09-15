import { NextResponse, type NextRequest } from "next/server";
import { loadSearchIndex, searchHits } from "@/lib/search-index";

export const dynamic = "force-dynamic";

const KINDS = new Set(["artist", "event", "work", "publication"]);
const PER_GROUP = 12;

/** Instant search over the cached index. ?q=<text>&scope=all|artist|event|work|publication */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const scope = req.nextUrl.searchParams.get("scope") ?? "all";
  if (q.length < 1) return NextResponse.json({ total: 0, groups: [] });

  const index = await loadSearchIndex();
  let hits = searchHits(index, q);
  if (KINDS.has(scope)) hits = hits.filter((h) => h.kind === scope);

  const order = ["artist", "work", "publication", "event"] as const;
  const groups = order
    .map((kind) => ({
      kind,
      total: hits.filter((h) => h.kind === kind).length,
      hits: hits
        .filter((h) => h.kind === kind)
        .slice(0, PER_GROUP)
        .map(({ haystack: _h, ...rest }) => rest),
    }))
    .filter((g) => g.total > 0);

  return NextResponse.json(
    { total: hits.length, groups },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
