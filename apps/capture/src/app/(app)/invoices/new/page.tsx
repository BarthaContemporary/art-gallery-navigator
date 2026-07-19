import { InvoiceCapture } from "@/components/invoice-capture";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "New invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const { batch } = await searchParams;
  const supabase = await getSupabase();

  // Candidate works to link the invoice to: this batch's works first, else the
  // most recently captured drafts.
  let query = supabase
    .from("capture_works")
    .select("id, maker, title, year, batch_id")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(30);
  if (batch) query = query.eq("batch_id", batch);
  const { data } = await query;

  const works = (data ?? []).map((w) => ({
    id: w.id,
    label: [w.maker, w.title].filter(Boolean).join(" — ") || "Untitled work",
    sub: w.year ?? "",
  }));

  return <InvoiceCapture batchId={batch ?? null} candidateWorks={works} />;
}
