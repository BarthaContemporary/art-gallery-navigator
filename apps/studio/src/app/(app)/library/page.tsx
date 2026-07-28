import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { FoldPanel } from "@/components/fold-panel";
import { NewDocument } from "@/components/new-document";

export const metadata = { title: "Inventory Lists & Docs" };

const KIND_LABEL: Record<string, string> = {
  import: "Import",
  export: "Export",
  temporary_import: "Temporary import",
  temporary_export: "Temporary export",
};
const TYPE_LABEL: Record<string, string> = {
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

const rowCls = "flex items-center justify-between gap-3 border-b border-line-soft py-2 text-[13px] last:border-0";
const manageCls = "rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid";
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

export default async function LibraryPage() {
  const supabase = await getSupabase();
  const [lists, shipments, documents, makers, locations, categories] = await Promise.all([
    supabase.from("piece_lists").select("id, name, piece_list_items(count)").order("name"),
    supabase
      .from("shipments")
      .select("id, kind, shipment_date, reference, piece_shipments(count)")
      .order("shipment_date", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase
      .from("piece_documents")
      .select("id, doc_type, title, doc_date, document_pieces(count)")
      .order("doc_date", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase.from("makers").select("id, display_name, life_dates").order("display_name"),
    supabase.from("locations").select("id, code, name, type").order("code"),
    supabase.from("categories").select("id, name, code, is_active").order("name"),
  ]);

  async function createShipment(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const { data: { user } } = await db.auth.getUser();
    const raw = String(formData.get("kind") ?? "import");
    const kind = ["export", "temporary_export", "temporary_import"].includes(raw) ? raw : "import";
    const { data } = await db.from("shipments").insert({ kind, created_by: user?.id ?? null }).select("id").single();
    if (data) redirect(`/shipments/${data.id}`);
    redirect("/library");
  }

  const listRows = (lists.data ?? []) as { id: string; name: string; piece_list_items: { count: number }[] }[];
  const shipRows = (shipments.data ?? []) as unknown as {
    id: string; kind: string; shipment_date: string | null; reference: string | null; piece_shipments: { count: number }[];
  }[];
  const docRows = (documents.data ?? []) as unknown as {
    id: string; doc_type: string; title: string | null; doc_date: string | null; document_pieces: { count: number }[];
  }[];
  const makerRows = (makers.data ?? []) as { id: string; display_name: string; life_dates: string | null }[];
  const locRows = (locations.data ?? []) as { id: string; code: string; name: string | null; type: string | null }[];
  const catRows = (categories.data ?? []) as { id: string; name: string; code: string; is_active: boolean }[];

  return (
    <div className="max-w-[820px]">
      <h1 className="text-[22px] font-semibold text-ink-strong">Inventory Lists &amp; Docs</h1>
      <p className="mt-1 text-[13px] text-ink-muted">Tap a section to open it.</p>

      <div className="mt-5 space-y-3">
        {/* Inventory lists */}
        <FoldPanel
          title="Inventory lists"
          count={listRows.length}
          action={<Link href="/inventory/lists" className={manageCls}>Manage / new →</Link>}
        >
          {listRows.length ? (
            <div>
              {listRows.map((l) => (
                <div key={l.id} className={rowCls}>
                  <Link href={`/inventory/lists/${l.id}`} className="min-w-0 truncate text-ink-body hover:text-oranje">{l.name}</Link>
                  <span className="font-mono text-[12px] text-ink-soft">{l.piece_list_items?.[0]?.count ?? 0}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-muted">No lists yet.</p>
          )}
        </FoldPanel>

        {/* Shipments */}
        <FoldPanel
          title="Shipments"
          count={shipRows.length}
          action={
            <>
              <form action={createShipment}><input type="hidden" name="kind" value="import" /><button className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg">New import</button></form>
              <form action={createShipment}><input type="hidden" name="kind" value="temporary_import" /><button className={manageCls}>New temporary import</button></form>
              <form action={createShipment}><input type="hidden" name="kind" value="export" /><button className={manageCls}>New export</button></form>
              <form action={createShipment}><input type="hidden" name="kind" value="temporary_export" /><button className={manageCls}>New temporary export</button></form>
              <Link href="/shipments" className="text-[12px] text-oranje hover:underline">All →</Link>
            </>
          }
        >
          {shipRows.length ? (
            <div>
              {shipRows.map((s) => (
                <div key={s.id} className={rowCls}>
                  <Link href={`/shipments/${s.id}`} className="min-w-0 truncate text-ink-body hover:text-oranje">
                    <span className="font-medium">{KIND_LABEL[s.kind] ?? s.kind}</span>
                    <span className="text-ink-muted"> · {fmt(s.shipment_date)}{s.reference ? ` · ${s.reference}` : ""}</span>
                  </Link>
                  <span className="font-mono text-[12px] text-ink-soft">{s.piece_shipments?.[0]?.count ?? 0} items</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-muted">No shipments yet.</p>
          )}
        </FoldPanel>

        {/* Documents */}
        <FoldPanel title="Documents" count={docRows.length} action={<><NewDocument /><Link href="/documents" className="text-[12px] text-oranje hover:underline">All →</Link></>}>
          {docRows.length ? (
            <div>
              {docRows.map((d) => (
                <div key={d.id} className={rowCls}>
                  <Link href={`/documents/${d.id}`} className="min-w-0 truncate text-ink-body hover:text-oranje">
                    <span className="font-medium">{TYPE_LABEL[d.doc_type] ?? d.doc_type.replace(/_/g, " ")}</span>
                    {d.title ? <span className="text-ink-muted"> · {d.title}</span> : null}
                    <span className="text-ink-muted"> · {fmt(d.doc_date)}</span>
                  </Link>
                  <span className="font-mono text-[12px] text-ink-soft">{d.document_pieces?.[0]?.count ?? 0} items</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] text-ink-muted">No documents yet.</p>
          )}
        </FoldPanel>

        {/* Makers */}
        <FoldPanel title="Makers" count={makerRows.length} action={<Link href="/makers" className={manageCls}>Manage / new →</Link>}>
          <div className="max-h-80 overflow-y-auto">
            {makerRows.map((m) => (
              <div key={m.id} className={rowCls}>
                <span className="min-w-0 truncate text-ink-body">{m.display_name}</span>
                <span className="font-mono text-[12px] text-ink-soft">{m.life_dates ?? ""}</span>
              </div>
            ))}
            {makerRows.length === 0 ? <p className="text-[12.5px] text-ink-muted">No makers yet.</p> : null}
          </div>
        </FoldPanel>

        {/* Locations */}
        <FoldPanel title="Locations" count={locRows.length} action={<Link href="/locations" className={manageCls}>Manage / new →</Link>}>
          <div className="max-h-80 overflow-y-auto">
            {locRows.map((l) => (
              <div key={l.id} className={rowCls}>
                <span className="text-ink-body"><span className="font-mono text-[12px] text-ink-muted">{l.code}</span>{l.name ? ` · ${l.name}` : ""}</span>
                <span className="text-[12px] text-ink-soft">{l.type ?? ""}</span>
              </div>
            ))}
            {locRows.length === 0 ? <p className="text-[12.5px] text-ink-muted">No locations yet.</p> : null}
          </div>
        </FoldPanel>

        {/* Categories — count is the number in use, since hidden ones don't
            appear in any picker. */}
        <FoldPanel
          title="Categories"
          count={catRows.filter((c) => c.is_active).length}
          action={<Link href="/categories" className={manageCls}>Manage / new →</Link>}
        >
          <div className="max-h-80 overflow-y-auto">
            {catRows.map((c) => (
              <div key={c.id} className={rowCls}>
                <span className={`min-w-0 truncate ${c.is_active ? "text-ink-body" : "text-ink-muted"}`}>
                  {c.name}
                </span>
                <span className="font-mono text-[12px] text-ink-soft">
                  {c.is_active ? c.code : "hidden"}
                </span>
              </div>
            ))}
            {catRows.length === 0 ? <p className="text-[12.5px] text-ink-muted">No categories yet.</p> : null}
          </div>
        </FoldPanel>
      </div>
    </div>
  );
}
