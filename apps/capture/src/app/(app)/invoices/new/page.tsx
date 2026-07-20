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

  // Recent invoices (skip the empty drafts) — deletable here.
  const { data: invData } = await supabase
    .from("capture_invoices")
    .select("id, vendor, reference, invoice_date, total, currency, capture_invoice_pages(count)")
    .order("created_at", { ascending: false })
    .limit(20);
  const recentInvoices = ((invData ?? []) as unknown as {
    id: string;
    vendor: string | null;
    reference: string | null;
    invoice_date: string | null;
    total: number | null;
    currency: string | null;
    capture_invoice_pages: { count: number }[];
  }[])
    .map((iv) => {
      const pages = iv.capture_invoice_pages?.[0]?.count ?? 0;
      return {
        id: iv.id,
        label: iv.vendor || iv.reference || "Invoice",
        sub: [iv.invoice_date, iv.total != null ? `${iv.currency ?? ""} ${iv.total}`.trim() : null, pages ? `${pages} pg` : null]
          .filter(Boolean)
          .join(" · "),
        empty: pages === 0 && !iv.vendor && iv.total == null,
      };
    })
    .filter((iv) => !iv.empty);

  return <InvoiceCapture batchId={batch ?? null} candidateWorks={works} recentInvoices={recentInvoices} />;
}
