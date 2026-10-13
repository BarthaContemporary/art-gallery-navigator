import Link from "next/link";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { loadPieceRows } from "@/lib/piece-store";
import { formatCount } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/notice";
import { Table, TableFrame, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Data review" };

type PieceRef = { stock_number: string; title: string | null } | null;

function StockLink({ piece }: { piece: PieceRef }) {
  if (!piece) return <span className="text-meta">—</span>;
  return (
    <Link
      href={`/inventory/${encodeURIComponent(piece.stock_number)}`}
      className="link-plain tabular text-ink"
    >
      {piece.stock_number}
    </Link>
  );
}

const header = <PageHeader back={{ href: "/admin", label: "Admin" }} title="Data review" />;

export default async function DataReview() {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) {
    return (
      <div className="max-w-[var(--jvb-measure)]">
        {header}
        <Notice tone="info">This review is available to administrators only.</Notice>
      </div>
    );
  }

  const db = createServiceClient();
  const [dupRes, finRes, issuesRes, totalRes] = await Promise.all([
    db
      .from("pieces")
      .select("stock_number, legacy_stock_number, title")
      .eq("legacy_stock_number_conflict", true)
      .order("legacy_stock_number")
      .limit(1000),
    db
      .from("piece_financials")
      .select(
        "piece_id, purchase_currency, purchase_fx, purchase_cost, sell_currency, sell_fx, sold_price",
      )
      .limit(2000),
    db
      .from("legacy_filemaker_rows")
      .select("row_number, issues, piece_id")
      .limit(2000),
    db.from("pieces").select("id", { count: "exact", head: true }),
  ]);

  // piece_financials and legacy_filemaker_rows key on the shared identity, so
  // the stock number and title are looked up from the union view.
  const migrationPieces = await loadPieceRows<{
    id: string;
    stock_number: string;
    title: string | null;
  }>(
    db,
    [
      ...((finRes.data ?? []) as { piece_id: string | null }[]).map((r) => r.piece_id ?? ""),
      ...((issuesRes.data ?? []) as { piece_id: string | null }[]).map((r) => r.piece_id ?? ""),
    ],
    "id, stock_number, title",
  );
  const attachPiece = <T extends { piece_id: string | null }>(rows: T[]) =>
    rows.map((r) => ({ ...r, piece: (r.piece_id ? migrationPieces.get(r.piece_id) : null) ?? null }));

  const dups = (dupRes.data ?? []) as {
    stock_number: string;
    legacy_stock_number: string | null;
    title: string | null;
  }[];

  const fxSuspect = (attachPiece((finRes.data ?? []) as any[]) as any[]).filter(
    (f) =>
      (f.purchase_currency &&
        f.purchase_currency !== "GBP" &&
        Number(f.purchase_fx) === 1 &&
        f.purchase_cost != null) ||
      (f.sell_currency &&
        f.sell_currency !== "GBP" &&
        Number(f.sell_fx) === 1 &&
        f.sold_price != null),
  );

  const flagged = (attachPiece((issuesRes.data ?? []) as any[]) as any[]).filter(
    (r) => Array.isArray(r.issues) && r.issues.length > 0,
  );
  // Roll up issue types for a quick tally.
  const issueTally = new Map<string, number>();
  for (const r of flagged)
    for (const i of r.issues as string[])
      issueTally.set(i, (issueTally.get(i) ?? 0) + 1);

  const none = <p className="text-[13px] text-body">None.</p>;

  return (
    <div className="max-w-[var(--jvb-measure-wide)]">
      <PageHeader
        back={{ href: "/admin", label: "Admin" }}
        title="Data review"
        meta={`${totalRes.count != null ? formatCount(totalRes.count) : "—"} records imported in total`}
      />
      <p className="mb-6 max-w-[70ch] text-[13.5px] leading-[1.5] text-body">
        Records flagged during the FileMaker import. The complete original row is preserved for
        every record; these are items to review, not data that was lost.
      </p>

      <div className="space-y-8">
        {/* Duplicate legacy stock numbers */}
        <Section
          title={`Duplicate legacy stock numbers (${dups.length})`}
          meta="Rows that shared a stock number in FileMaker. Each kept its own new stock number; the legacy number is kept for reference."
        >
          {dups.length ? (
            <TableFrame>
              <Table className="min-w-[560px]">
                <thead>
                  <tr>
                    <Th>Stock</Th>
                    <Th>Legacy no.</Th>
                    <Th>Title</Th>
                  </tr>
                </thead>
                <tbody>
                  {dups.map((d) => (
                    <Tr key={d.stock_number}>
                      <Td>
                        <StockLink piece={{ stock_number: d.stock_number, title: d.title }} />
                      </Td>
                      <Td className="tabular text-body">{d.legacy_stock_number ?? "—"}</Td>
                      <Td className="text-ink">{d.title ?? "Untitled"}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
          ) : (
            none
          )}
        </Section>

        {/* Unconverted foreign currency */}
        <Section
          title={`Unconverted foreign-currency amounts (${fxSuspect.length})`}
          meta="The purchase or sale is in EUR, USD or CHF but the exchange rate is still 1. Open each record: enter the purchase £ by hand, and set the sale date so the sale £ converts from that day's spot rate."
        >
          {fxSuspect.length ? (
            <TableFrame>
              <Table className="min-w-[560px]">
                <thead>
                  <tr>
                    <Th>Stock</Th>
                    <Th>Title</Th>
                    <Th>Detail</Th>
                  </tr>
                </thead>
                <tbody>
                  {fxSuspect.map((f, i) => (
                    <Tr key={i}>
                      <Td>
                        <StockLink piece={f.piece} />
                      </Td>
                      <Td className="text-ink">{f.piece?.title ?? "Untitled"}</Td>
                      <Td className="tabular text-body">
                        {f.purchase_currency !== "GBP" && f.purchase_cost != null
                          ? `Purchase ${f.purchase_cost} ${f.purchase_currency}`
                          : ""}
                        {f.sell_currency !== "GBP" && f.sold_price != null
                          ? `${f.purchase_currency !== "GBP" ? " · " : ""}Sale ${f.sold_price} ${f.sell_currency}`
                          : ""}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
          ) : (
            none
          )}
        </Section>

        {/* Other flagged rows (from the import issues log, if recorded) */}
        <Section
          title={`Other flagged rows (${flagged.length})`}
          meta={
            issueTally.size
              ? [...issueTally.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`)
                  .join(" · ")
              : undefined
          }
        >
          {flagged.length ? (
            <TableFrame>
              <Table className="min-w-[560px]">
                <thead>
                  <tr>
                    <Th>Row</Th>
                    <Th>Stock</Th>
                    <Th>Issues</Th>
                  </tr>
                </thead>
                <tbody>
                  {flagged.slice(0, 500).map((r) => (
                    <Tr key={r.row_number}>
                      <Td className="tabular text-body">{r.row_number}</Td>
                      <Td>
                        <StockLink piece={r.piece} />
                      </Td>
                      <Td className="text-body">
                        {(r.issues as string[]).map((i) => i.replace(/_/g, " ")).join(", ")}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableFrame>
          ) : (
            <p className="text-[13px] text-body">No per-row issue log recorded in the database.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
