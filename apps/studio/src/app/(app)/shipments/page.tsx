import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { formatCount, formatDate } from "@/lib/format";
import { SHIPMENT_KIND_LABELS as KIND_LABEL, labelOf } from "@/lib/labels";
import { PageHeader } from "@/components/ui/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { SegmentedLinks } from "@/components/ui/chips";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Shipments" };

type Row = {
  id: string;
  kind: "import" | "export" | "temporary_export" | "temporary_import";
  shipment_date: string | null;
  reference: string | null;
  piece_shipments: { count: number }[];
  shipment_documents: { count: number }[];
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

  const filters = (
    [
      ["", "All"],
      ["import", "Imports"],
      ["temporary_import", "Temp imports"],
      ["export", "Exports"],
      ["temporary_export", "Temp exports"],
    ] as const
  ).map(([v, l]) => ({ value: v, label: l, href: v ? `/shipments?kind=${v}` : "/shipments" }));
  const kind = sp.kind && KINDS.includes(sp.kind) ? sp.kind : "";

  return (
    <div>
      <PageHeader
        title="Shipments"
        meta={
          <span className="tabular">
            {formatCount(rows.length)} {rows.length === 1 ? "shipment" : "shipments"}
          </span>
        }
        actions={
          <>
            <form action={createShipment}>
              <input type="hidden" name="kind" value="import" />
              <Button type="submit" variant="primary" pendingLabel="Creating…">
                New import
              </Button>
            </form>
            <form action={createShipment}>
              <input type="hidden" name="kind" value="temporary_import" />
              <Button type="submit" pendingLabel="Creating…">
                New temporary import
              </Button>
            </form>
            <form action={createShipment}>
              <input type="hidden" name="kind" value="export" />
              <Button type="submit" pendingLabel="Creating…">
                New export
              </Button>
            </form>
            <form action={createShipment}>
              <input type="hidden" name="kind" value="temporary_export" />
              <Button type="submit" pendingLabel="Creating…">
                New temporary export
              </Button>
            </form>
          </>
        }
      >
        <p className="max-w-[var(--jvb-measure)] text-[13px] leading-[1.45] text-body">
          Record an import or export once (date, reference and documents), then attach the
          inventory items it covers.
        </p>
      </PageHeader>

      <SegmentedLinks aria-label="Kind of shipment" items={filters} current={kind} className="mb-3" />

      <TableFrame bordered>
        <Table className="min-w-[560px]">
          <thead>
            <tr>
              <Th>Kind</Th>
              <Th>Date</Th>
              <Th>Reference</Th>
              <Th numeric>Items</Th>
              <Th numeric>Files</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Link href={`/shipments/${r.id}`} className="link-plain font-medium text-ink">
                    {labelOf(KIND_LABEL, r.kind)}
                  </Link>
                </Td>
                <Td className="tabular text-body">{formatDate(r.shipment_date, "numeric")}</Td>
                <Td className="text-body">{r.reference ?? "—"}</Td>
                <Td numeric className="text-body">
                  {r.piece_shipments?.[0]?.count ?? 0}
                </Td>
                <Td numeric className="text-body">
                  {r.shipment_documents?.[0]?.count ?? 0}
                </Td>
              </Tr>
            ))}
            {rows.length === 0 ? (
              <EmptyRow
                colSpan={5}
                action={
                  kind ? (
                    <ButtonLink href="/shipments" size="sm">
                      All shipments
                    </ButtonLink>
                  ) : undefined
                }
              >
                {kind ? "No shipments of this kind yet." : "No shipments yet. Start one with New import or New export above."}
              </EmptyRow>
            ) : null}
          </tbody>
        </Table>
      </TableFrame>
    </div>
  );
}
