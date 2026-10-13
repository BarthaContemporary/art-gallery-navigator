import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { countListMembers } from "@/lib/list-members";
import { FoldPanel } from "@/components/fold-panel";
import { NewDocument } from "@/components/new-document";
import { formatDate } from "@/lib/format";
import { DOC_TYPE_LABELS, SHIPMENT_KIND_LABELS, labelOf } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon } from "@/components/ui/icons";

export const metadata = { title: "Inventory lists & docs" };

const rowCls =
  "flex items-center justify-between gap-3 border-b border-rule py-2 text-[13px] leading-[1.45] first:border-t";
/** A row that opens its record: the name in ink, underlined on hover. */
const nameCls = "link-plain min-w-0 truncate text-ink";
const countCls = "tabular shrink-0 text-[12px] leading-[1.4] text-meta";
const emptyCls = "text-[13px] leading-[1.45] text-body";
// shipment_date and doc_date are `date` columns: printed as the day they name.
const fmt = (d: string | null) => formatDate(d, "numeric");

export default async function LibraryPage() {
  const supabase = await getSupabase();
  const [lists, shipments, documents, makers, locations, categories] = await Promise.all([
    supabase
      .from("piece_lists")
      .select("id, name, is_dynamic, filter_rules, piece_list_items(count)")
      .order("sort_order")
      .order("name"),
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
    supabase.from("locations").select("id, code, name, type").order("sort_order").order("code"),
    supabase.from("categories").select("id, name, code, is_active").order("sort_order").order("name"),
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

  const rawLists = (lists.data ?? []) as {
    id: string;
    name: string;
    is_dynamic: boolean | null;
    filter_rules: {
      q?: string | null;
      status?: string | null;
      category?: string | null;
      location?: string | null;
    } | null;
    piece_list_items: { count: number }[];
  }[];

  // A live list has no rows in piece_list_items — its membership is the saved
  // filters, re-run on read. Counting the join table therefore reported 0 for
  // every live list ("Works at auction" showed 0 while holding 65). The shared
  // counter re-runs the rules the way the list page resolves them (exclusions
  // such as "not Sold", register, framed, pinned-out works), so the number
  // means the same thing here, on the Lists page and on the list itself.
  const listRows = await Promise.all(
    rawLists.map(async (l) => ({
      id: l.id,
      name: l.name,
      isDynamic: Boolean(l.is_dynamic),
      count: await countListMembers(supabase, l),
    })),
  );
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
    <div className="max-w-[960px]">
      <PageHeader
        title="Inventory lists & docs"
        meta="Lists, shipments, documents, makers, locations and categories, each one click from its record."
      />

      <div className="border-b border-rule-strong">
        {/* Inventory lists */}
        <FoldPanel
          title="Inventory lists"
          count={listRows.length}
          action={<ManageLink href="/inventory/lists">Manage lists</ManageLink>}
        >
          {listRows.length ? (
            <div>
              {listRows.map((l) => (
                <div key={l.id} className={rowCls}>
                  <Link href={`/inventory/lists/${l.id}`} className={nameCls}>
                    {l.name}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    {l.isDynamic ? <Badge tone="info" size="xs">Live</Badge> : null}
                    <span className={countCls}>{l.count}</span>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={emptyCls}>No lists yet.</p>
          )}
        </FoldPanel>

        {/* Shipments */}
        <FoldPanel
          title="Shipments"
          count={shipRows.length}
          action={
            <>
              <form action={createShipment}><input type="hidden" name="kind" value="import" /><Button type="submit" size="sm" pendingLabel="Creating…">New import</Button></form>
              <form action={createShipment}><input type="hidden" name="kind" value="temporary_import" /><Button type="submit" size="sm" pendingLabel="Creating…">New temporary import</Button></form>
              <form action={createShipment}><input type="hidden" name="kind" value="export" /><Button type="submit" size="sm" pendingLabel="Creating…">New export</Button></form>
              <form action={createShipment}><input type="hidden" name="kind" value="temporary_export" /><Button type="submit" size="sm" pendingLabel="Creating…">New temporary export</Button></form>
              <ManageLink href="/shipments">All shipments</ManageLink>
            </>
          }
        >
          {shipRows.length ? (
            <div>
              {shipRows.map((s) => (
                <div key={s.id} className={rowCls}>
                  <Link href={`/shipments/${s.id}`} className={nameCls}>
                    <span className="font-medium">{labelOf(SHIPMENT_KIND_LABELS, s.kind)}</span>
                    <span className="text-body"> · {fmt(s.shipment_date)}{s.reference ? ` · ${s.reference}` : ""}</span>
                  </Link>
                  <span className={countCls}>{s.piece_shipments?.[0]?.count ?? 0} items</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={emptyCls}>No shipments yet.</p>
          )}
        </FoldPanel>

        {/* Documents */}
        <FoldPanel
          title="Documents"
          count={docRows.length}
          action={
            <>
              <NewDocument />
              <ManageLink href="/documents">All documents</ManageLink>
            </>
          }
        >
          {docRows.length ? (
            <div>
              {docRows.map((d) => (
                <div key={d.id} className={rowCls}>
                  <Link href={`/documents/${d.id}`} className={nameCls}>
                    <span className="font-medium">{labelOf(DOC_TYPE_LABELS, d.doc_type)}</span>
                    {d.title ? <span className="text-body"> · {d.title}</span> : null}
                    <span className="text-body"> · {fmt(d.doc_date)}</span>
                  </Link>
                  <span className={countCls}>{d.document_pieces?.[0]?.count ?? 0} items</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={emptyCls}>No documents yet.</p>
          )}
        </FoldPanel>

        {/* Makers: each row opens the maker's page. */}
        <FoldPanel title="Makers" count={makerRows.length} action={<ManageLink href="/makers">Manage makers</ManageLink>}>
          <div className="max-h-80 overflow-y-auto" data-inset-focus>
            {makerRows.map((m) => (
              <div key={m.id} className={rowCls}>
                <Link href={`/makers/${m.id}`} className={nameCls}>
                  {m.display_name}
                </Link>
                <span className={countCls}>{m.life_dates ?? ""}</span>
              </div>
            ))}
            {makerRows.length === 0 ? <p className={emptyCls}>No makers yet.</p> : null}
          </div>
        </FoldPanel>

        {/* Locations have no page of their own: a row opens the works kept
            there, as the Locations page does. */}
        <FoldPanel title="Locations" count={locRows.length} action={<ManageLink href="/locations">Manage locations</ManageLink>}>
          <div className="max-h-80 overflow-y-auto" data-inset-focus>
            {locRows.map((l) => (
              <div key={l.id} className={rowCls}>
                <Link
                  href={`/inventory?location=${l.id}`}
                  className={nameCls}
                  title="Show the works at this location"
                >
                  <span className="tabular text-body">{l.code}</span>
                  {l.name ? ` · ${l.name}` : ""}
                </Link>
                <span className="shrink-0 text-[12px] leading-[1.4] text-meta">{l.type ?? ""}</span>
              </div>
            ))}
            {locRows.length === 0 ? <p className={emptyCls}>No locations yet.</p> : null}
          </div>
        </FoldPanel>

        {/* Categories: count is the number in use, since hidden ones don't
            appear in any picker. A row opens the works in it. */}
        <FoldPanel
          title="Categories"
          count={catRows.filter((c) => c.is_active).length}
          action={<ManageLink href="/categories">Manage categories</ManageLink>}
        >
          <div className="max-h-80 overflow-y-auto" data-inset-focus>
            {catRows.map((c) => (
              <div key={c.id} className={rowCls}>
                <Link
                  href={`/inventory?category=${c.id}`}
                  className={`link-plain min-w-0 truncate ${c.is_active ? "text-ink" : "text-meta"}`}
                  title="Show the works in this category"
                >
                  {c.name}
                </Link>
                <span className={countCls}>{c.is_active ? c.code : "hidden"}</span>
              </div>
            ))}
            {catRows.length === 0 ? <p className={emptyCls}>No categories yet.</p> : null}
          </div>
        </FoldPanel>
      </div>
    </div>
  );
}

/** The way from a panel to the page that manages it: an action link (spec R2). */
function ManageLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="link inline-flex min-h-[var(--jvb-control-h-sm)] items-center gap-1 text-[13px]">
      {children}
      <ArrowRightIcon size={14} />
    </Link>
  );
}
