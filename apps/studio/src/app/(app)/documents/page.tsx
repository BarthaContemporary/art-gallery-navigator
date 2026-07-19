import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { NewDocument } from "@/components/new-document";

export const metadata = { title: "Documents" };

const TYPE_LABELS: Record<string, string> = {
  purchase_invoice: "Purchase invoice",
  sale_invoice: "Sale invoice",
  provenance_document: "Provenance",
  correspondence: "Correspondence",
  shipping: "Shipping",
  insurance: "Insurance",
  certificate: "Certificate",
  condition_report: "Condition report",
  export_licence: "Export licence",
  import_document: "Import documents",
  other: "Other",
};

type Row = {
  id: string;
  doc_type: string;
  title: string | null;
  reference: string | null;
  doc_date: string | null;
  document_pieces: { count: number }[];
};

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabase();

  let query = supabase
    .from("piece_documents")
    .select("id, doc_type, title, reference, doc_date, document_pieces(count)")
    .order("doc_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (sp.type) query = query.eq("doc_type", sp.type);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="max-w-[1000px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-ink-strong">Documents</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Invoices, provenance, correspondence, shipping and insurance — upload once and
            link to every inventory item it covers.
          </p>
        </div>
        <NewDocument />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 text-[12px]">
        <Link
          href="/documents"
          className={`rounded-lg border px-3 py-1.5 font-medium ${!sp.type ? "border-oranje text-oranje" : "border-line-control bg-control text-ink-mid"}`}
        >
          All
        </Link>
        {Object.entries(TYPE_LABELS).map(([v, l]) => (
          <Link
            key={v}
            href={`/documents?type=${v}`}
            className={`rounded-lg border px-3 py-1.5 font-medium ${sp.type === v ? "border-oranje text-oranje" : "border-line-control bg-control text-ink-mid"}`}
          >
            {l}
          </Link>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[640px] bg-cell text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Reference</th>
              <th className="px-4 py-2.5 font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-control">
                <td className="px-4 py-2.5">
                  <Link href={`/documents/${r.id}`} className="font-medium text-ink-body">
                    {TYPE_LABELS[r.doc_type] ?? r.doc_type.replace(/_/g, " ")}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{r.title ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                  {r.doc_date ? new Date(r.doc_date).toLocaleDateString("en-GB") : "—"}
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{r.reference ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                  {r.document_pieces?.[0]?.count ?? 0}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">No documents yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
