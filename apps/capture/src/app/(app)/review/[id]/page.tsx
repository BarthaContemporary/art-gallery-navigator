import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ReviewBatch, type ReviewWork } from "@/components/review-batch";

export const metadata = { title: "Review batch" };
export const dynamic = "force-dynamic";

export default async function ReviewBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();

  const { data: batch } = await supabase
    .from("capture_batches")
    .select("id, captured_at, source_name, source_type, source_address, status")
    .eq("id", id)
    .maybeSingle();
  if (!batch) notFound();

  const { data: works } = await supabase
    .from("capture_works")
    .select("id, maker, title, year, medium, dimensions_text, period, origin_region, category, notes, status, pushed_piece_id")
    .eq("batch_id", id)
    .eq("status", "draft")
    .order("sort_order");

  // Photos + a small signed rendition for each (storage resizes it; the
  // originals are 12-24 MP and these tiles are 80 px).
  const workIds = (works ?? []).map((w) => w.id);
  const photosByWork = new Map<string, { id: string; url: string; is_label: boolean }[]>();
  const linkedWorkIds = new Set<string>();
  const stockNumbers = new Map<string, string>();

  if (workIds.length) {
    const { data: photos } = await supabase
      .from("capture_photos")
      .select("id, work_id, storage_path, is_label, sort_order")
      .in("work_id", workIds)
      .order("sort_order");
    const signed = await Promise.all(
      (photos ?? []).map((p) =>
        supabase.storage
          .from("captures")
          .createSignedUrl(p.storage_path, 60 * 60, { transform: { width: 240, height: 240, resize: "cover", quality: 70 } })
          .then(({ data }) => data?.signedUrl ?? null),
      ),
    );
    (photos ?? []).forEach((p, i) => {
      const url = signed[i];
      if (!p.work_id || !url) return;
      const arr = photosByWork.get(p.work_id) ?? [];
      arr.push({ id: p.id, url, is_label: p.is_label });
      photosByWork.set(p.work_id, arr);
    });

    const { data: links } = await supabase
      .from("capture_invoice_links")
      .select("work_id")
      .in("work_id", workIds);
    for (const l of links ?? []) if (l.work_id) linkedWorkIds.add(l.work_id);

    // Works an earlier push created a stock record for but did not finish.
    // The record takes the work's id (lib/push.ts), so one that was never
    // written down as pushed_piece_id is found too.
    const pieceIds = (works ?? []).map((w) => w.pushed_piece_id ?? w.id);
    if (pieceIds.length) {
      const { data: pieces } = await supabase.from("vw_pieces_list").select("id, stock_number").in("id", pieceIds);
      for (const p of pieces ?? []) if (p.stock_number) stockNumbers.set(p.id, p.stock_number);
    }
  }

  const reviewWorks: ReviewWork[] = (works ?? [])
    .filter((w) => w.status === "draft")
    .map((w) => ({
      id: w.id,
      fields: {
        maker: w.maker ?? "",
        title: w.title ?? "",
        year: w.year ?? "",
        medium: w.medium ?? "",
        dimensions_text: w.dimensions_text ?? "",
        period: w.period ?? "",
        origin_region: w.origin_region ?? "",
        category: w.category ?? "",
        notes: w.notes ?? "",
      },
      photos: photosByWork.get(w.id) ?? [],
      hasInvoice: linkedWorkIds.has(w.id),
      stockNumber: stockNumbers.get(w.pushed_piece_id ?? w.id) ?? null,
    }));

  // The day the push records as the purchase date (lib/push.ts londonDay),
  // whatever zone the server renders in.
  const purchased = new Date(batch.captured_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });

  return (
    <div className="pt-1">
      <div className="flex items-center justify-between">
        <Link href="/review" className="text-[12px] text-ink-soft">‹ Back</Link>
        <Link href="/" className="text-[12px] text-ink-soft">Home</Link>
      </div>
      <h1 className="mt-2 text-[20px] font-bold tracking-[-0.01em] text-ink-strong">
        {batch.source_name || "Unknown source"}
      </h1>
      <p className="mt-0.5 text-[12.5px] text-ink-muted">
        Purchased {purchased}
        {batch.source_type ? ` · ${batch.source_type}` : ""}
      </p>

      <ReviewBatch batchId={batch.id} initialWorks={reviewWorks} />
    </div>
  );
}
