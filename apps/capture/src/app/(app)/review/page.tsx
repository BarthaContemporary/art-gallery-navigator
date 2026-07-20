import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { ReviewList } from "@/components/review-list";
import { IconCheck } from "@/components/icons";

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

      <ReviewList
        batches={drafts.map((b) => ({
          id: b.id,
          name: b.source_name || "Unknown source",
          date: fmt(b.captured_at),
          count: b.capture_works?.[0]?.count ?? 0,
        }))}
      />

      {pushed.length ? (
        <div className="mt-8">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-faint">Recently pushed</h2>
          <div className="mt-2 space-y-1">
            {pushed.slice(0, 8).map((b) => (
              <div key={b.id} className="flex items-center justify-between px-1 py-1.5 text-[13px] text-ink-muted">
                <span className="truncate">{b.source_name || "Unknown source"}</span>
                <span className="flex items-center gap-1 text-[11.5px] text-status-green">
                  <IconCheck className="h-3.5 w-3.5" /> in inventory
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <p className="mt-6 text-center text-[11px] text-ink-faint">{today.getFullYear()}</p>
    </div>
  );
}
