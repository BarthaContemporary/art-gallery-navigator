import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Edit & push" };
export const dynamic = "force-dynamic";

const today = new Date();

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function ReviewPage() {
  const supabase = await getSupabase();
  const { data: batches } = await supabase
    .from("capture_batches")
    .select("id, captured_at, source_name, source_type, status, capture_works(count)")
    .order("captured_at", { ascending: false })
    .limit(60);

  const rows = (batches ?? []) as unknown as {
    id: string;
    captured_at: string;
    source_name: string | null;
    source_type: string | null;
    status: string;
    capture_works: { count: number }[];
  }[];

  const drafts = rows.filter((b) => b.status === "draft" && (b.capture_works?.[0]?.count ?? 0) > 0);
  const pushed = rows.filter((b) => b.status === "pushed");

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between">
        <h1 className="text-[20px] font-bold tracking-[-0.01em] text-ink-strong">Edit & push</h1>
        <Link href="/" className="text-[12px] text-ink-soft">Home</Link>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">Review captured purchases, then add them to the inventory.</p>

      {drafts.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-line-control bg-cell px-4 py-8 text-center text-[13px] text-ink-soft">
          Nothing waiting. Capture some works first.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {drafts.map((b) => (
            <Link
              key={b.id}
              href={`/review/${b.id}`}
              className="tap flex items-center justify-between gap-3 rounded-2xl border border-line bg-cell px-4 py-3.5 active:bg-control/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-ink-strong">
                  {b.source_name || "Unknown source"}
                </span>
                <span className="block text-[12px] text-ink-muted">
                  {fmt(b.captured_at)} · {b.capture_works?.[0]?.count ?? 0} work(s)
                </span>
              </span>
              <span className="shrink-0 text-ink-soft">›</span>
            </Link>
          ))}
        </div>
      )}

      {pushed.length ? (
        <div className="mt-8">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Recently pushed</h2>
          <div className="mt-2 space-y-1">
            {pushed.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center justify-between px-1 py-1.5 text-[13px] text-ink-muted">
                <span className="truncate">{b.source_name || "Unknown source"}</span>
                <span className="text-[11.5px] text-status-green">✓ in inventory</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-center text-[11px] text-ink-faint">{today.getFullYear()}</p>
    </div>
  );
}
