import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

export const metadata = { title: "Shipments" };

type Row = {
  id: string;
  kind: "import" | "export" | "temporary_export" | "temporary_import";
  shipment_date: string | null;
  reference: string | null;
  piece_shipments: { count: number }[];
  shipment_documents: { count: number }[];
};

const KIND_LABEL: Record<string, string> = {
  import: "Import",
  temporary_import: "Temporary import",
  export: "Export",
  temporary_export: "Temporary export",
};

const KINDS = ["import", "export", "temporary_export", "temporary_import"];

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await getSupabase();

  let query = supabase
    .from("shipments")
    .select(
      "id, kind, shipment_date, reference, piece_shipments(count), shipment_documents(count)",
    )
    .order("shipment_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (sp.kind && KINDS.includes(sp.kind)) query = query.eq("kind", sp.kind);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  async function createShipment(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    const raw = String(formData.get("kind") ?? "import");
    const kind = KINDS.includes(raw) ? raw : "import";
    const { data: created } = await db
      .from("shipments")
      .insert({ kind, created_by: user?.id ?? null })
      .select("id")
      .single();
    if (created) redirect(`/shipments/${created.id}`);
    redirect("/shipments");
  }

  return (
    <div className="max-w-[1000px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold text-ink-strong">Shipments</h1>
        <div className="flex items-center gap-2">
          <form action={createShipment}>
            <input type="hidden" name="kind" value="import" />
            <button className="rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-fg">
              New import
            </button>
          </form>
          <form action={createShipment}>
            <input type="hidden" name="kind" value="temporary_import" />
            <button className="rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-semibold text-ink-mid">
              New temporary import
            </button>
          </form>
          <form action={createShipment}>
            <input type="hidden" name="kind" value="export" />
            <button className="rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-semibold text-ink-mid">
              New export
            </button>
          </form>
          <form action={createShipment}>
            <input type="hidden" name="kind" value="temporary_export" />
            <button className="rounded-lg border border-line-control bg-control px-3.5 py-2 text-[12.5px] font-semibold text-ink-mid">
              New temporary export
            </button>
          </form>
        </div>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">
        Record an import or export once — date, reference and document(s) — then attach the
        inventory items it covers.
      </p>

      <div className="mt-4 flex gap-1.5 text-[12.5px]">
        {[
          ["", "All"],
          ["import", "Imports"],
          ["temporary_import", "Temp imports"],
          ["export", "Exports"],
          ["temporary_export", "Temp exports"],
        ].map(([v, l]) => (
          <Link
            key={l}
            href={v ? `/shipments?kind=${v}` : "/shipments"}
            className={`rounded-lg border px-3 py-1.5 font-medium ${
              (sp.kind ?? "") === v
                ? "border-oranje text-oranje"
                : "border-line-control bg-control text-ink-mid"
            }`}
          >
            {l}
          </Link>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto rounded-[11px] border border-line">
        <table className="w-full min-w-[640px] bg-cell text-left text-[13px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
              <th className="px-4 py-2.5 font-medium">Kind</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Reference</th>
              <th className="px-4 py-2.5 font-medium">Items</th>
              <th className="px-4 py-2.5 font-medium">Files</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-control">
                <td className="px-4 py-2.5">
                  <Link href={`/shipments/${r.id}`} className="font-medium text-ink-body">
                    {KIND_LABEL[r.kind] ?? r.kind}
                  </Link>
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                  {r.shipment_date ? new Date(r.shipment_date).toLocaleDateString("en-GB") : "—"}
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{r.reference ?? "—"}</td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                  {r.piece_shipments?.[0]?.count ?? 0}
                </td>
                <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">
                  {r.shipment_documents?.[0]?.count ?? 0}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  No shipments yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
