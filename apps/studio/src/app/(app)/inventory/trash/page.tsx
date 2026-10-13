import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { DeleteListButton } from "@/components/delete-list-button";
import { LEDGER_LABEL, type Ledger, type PieceRef } from "@/lib/piece-store";
// London dates: this page renders on the server, where the zone is UTC.
import { formatCount, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyRow, Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Trash" };

const RETENTION_DAYS = 30;

type TrashRow = {
  id: string;
  stock_number: string;
  title: string | null;
  deleted_at: string;
  /** Which stock table to reinstate into or purge from. */
  table: PieceRef["table"];
  ledger: Ledger;
};

export default async function TrashPage() {
  const supabase = await getSupabase();
  // The union view drops soft-deleted rows on purpose, so the recycle bin
  // reads both stock tables directly and remembers which one each row is in.
  const [jvb, external] = await Promise.all(
    (["pieces", "external_pieces"] as const).map((table) =>
      supabase
        .from(table)
        .select("id, stock_number, title, deleted_at")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ),
  );
  const rows: TrashRow[] = [
    ...((jvb?.data ?? []) as Omit<TrashRow, "table" | "ledger">[]).map((r) => ({
      ...r,
      table: "pieces" as const,
      ledger: "jvb" as const,
    })),
    ...((external?.data ?? []) as Omit<TrashRow, "table" | "ledger">[]).map((r) => ({
      ...r,
      table: "external_pieces" as const,
      ledger: "external" as const,
    })),
  ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));

  async function reinstate(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const id = String(formData.get("id") ?? "");
    const table = String(formData.get("table") ?? "");
    if (!id || (table !== "pieces" && table !== "external_pieces")) return;
    await db.from(table).update({ deleted_at: null }).eq("id", id);
    revalidatePath("/inventory/trash");
    revalidatePath("/inventory");
  }

  async function purge(formData: FormData) {
    "use server";
    const db = await getSupabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return;
    const id = String(formData.get("id") ?? "");
    const table = String(formData.get("table") ?? "");
    if (!id || (table !== "pieces" && table !== "external_pieces")) return;
    // Permanent delete. Removing the last stock row drops the identity too,
    // which cascades to images, financials, provenance and the rest.
    await db.from(table).delete().eq("id", id);
    revalidatePath("/inventory/trash");
  }

  const daysLeft = (deletedAt: string) => {
    const elapsed = (Date.now() - new Date(deletedAt).getTime()) / 86_400_000;
    return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
  };

  return (
    <div>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        title="Trash"
        meta={`${formatCount(rows.length)} ${rows.length === 1 ? "record" : "records"}`}
      >
        <p className="max-w-[640px] text-[13px] leading-[1.45] text-body">
          Deleted records are kept for {RETENTION_DAYS} days, then permanently removed. A work shown
          on the website is taken off it straight away, and returns if you reinstate the record.
        </p>
      </PageHeader>

      <TableFrame>
        <Table>
          <thead>
            <tr>
              <Th className="hidden w-36 sm:table-cell">Stock</Th>
              <Th>Title</Th>
              <Th className="hidden w-32 sm:table-cell">Deleted</Th>
              <Th className="hidden w-40 sm:table-cell" numeric>
                Auto-removed in
              </Th>
              <Th className="w-28 sm:w-44">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td className="hidden sm:table-cell">
                  <StockNumber row={r} />
                </Td>
                <Td className="text-ink">
                  {/* A phone drops the stock, date and countdown columns;
                      they fold in under the title. */}
                  <span className="mb-0.5 block sm:hidden">
                    <StockNumber row={r} />
                  </span>
                  {r.title ?? "Untitled"}
                  <span className="tabular mt-0.5 block text-[12px] leading-[1.4] text-meta sm:hidden">
                    Deleted {formatDate(r.deleted_at, "numeric")}, {daysLeft(r.deleted_at)} days left
                  </span>
                </Td>
                <Td className="tabular hidden text-body sm:table-cell">{formatDate(r.deleted_at, "numeric")}</Td>
                <Td numeric className="hidden text-body sm:table-cell">
                  {daysLeft(r.deleted_at)} days
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                    <form action={reinstate}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="table" value={r.table} />
                      <Button type="submit" size="sm" pendingLabel="Reinstating…">
                        Reinstate
                      </Button>
                    </form>
                    <DeleteListButton
                      action={purge}
                      id={r.id}
                      name={r.stock_number}
                      extra={{ table: r.table }}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 ? <EmptyRow colSpan={5}>Trash is empty.</EmptyRow> : null}
          </tbody>
        </Table>
      </TableFrame>
    </div>
  );
}

function StockNumber({ row }: { row: TrashRow }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="tabular text-ink">{row.stock_number}</span>
      {row.ledger === "external" ? (
        <Badge caps size="xs">
          {LEDGER_LABEL.external}
        </Badge>
      ) : null}
    </span>
  );
}
