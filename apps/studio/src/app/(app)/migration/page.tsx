import Link from "next/link";
import { getSession, hasRole, createServiceClient } from "@/lib/supabase";
import { loadPieceRows } from "@/lib/piece-store";

export const metadata = { title: "Data review" };

type PieceRef = { stock_number: string; title: string | null } | null;

const box = "mt-4 overflow-x-auto rounded-[11px] border border-line";
const th = "px-4 py-2.5 font-medium";
const td = "px-4 py-2.5 text-[13px]";

function StockLink({ piece }: { piece: PieceRef }) {
  if (!piece) return <span className="text-ink-soft">—</span>;
  return (
    <Link
      href={`/inventory/${encodeURIComponent(piece.stock_number)}`}
      className="font-mono text-[12px] text-ink hover:text-oranje"
    >
      {piece.stock_number}
    </Link>
  );
}

export default async function DataReview() {
  const session = await getSession();
  if (!session || !hasRole(session.roles, "admin")) {
    return (
      <p className="text-[13px] text-ink-muted">
        This review is available to administrators only.
      </p>
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

  return (
    <div className="max-w-[1000px]">
      <p className="text-[13px] text-ink-muted">
        Records flagged during the FileMaker import. The complete original row is
        preserved for every record; these are items to review, not data that was
        lost. {totalRes.count ?? "—"} pieces imported in total.
      </p>

      {/* Duplicate legacy stock numbers */}
      <section className="mt-6">
        <h2 className="text-[13px] font-semibold text-ink-strong">
          Duplicate legacy stock numbers ({dups.length})
        </h2>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Rows that shared a stock number in FileMaker. Each kept its own new
          stock number; the legacy number is retained for reference.
        </p>
        {dups.length ? (
          <div className={box}>
            <table className="w-full min-w-[560px] bg-cell text-left">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  <th className={th}>Stock</th>
                  <th className={th}>Legacy #</th>
                  <th className={th}>Title</th>
                </tr>
              </thead>
              <tbody>
                {dups.map((d) => (
                  <tr key={d.stock_number} className="border-b border-line-soft last:border-0">
                    <td className={td}>
                      <StockLink piece={{ stock_number: d.stock_number, title: d.title }} />
                    </td>
                    <td className={`${td} font-mono text-ink-muted`}>
                      {d.legacy_stock_number ?? "—"}
                    </td>
                    <td className={`${td} text-ink-body`}>{d.title ?? "Untitled"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-muted">None.</p>
        )}
      </section>

      {/* Unconverted foreign currency */}
      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-ink-strong">
          Unconverted foreign-currency amounts ({fxSuspect.length})
        </h2>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Purchase or sale is in EUR/USD/CHF but the FX rate is still 1. Open each
          record and set the purchase/sale date — the £ value now recalculates
          from the spot rate on that date automatically.
        </p>
        {fxSuspect.length ? (
          <div className={box}>
            <table className="w-full min-w-[560px] bg-cell text-left">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  <th className={th}>Stock</th>
                  <th className={th}>Title</th>
                  <th className={th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {fxSuspect.map((f, i) => (
                  <tr key={i} className="border-b border-line-soft last:border-0">
                    <td className={td}>
                      <StockLink piece={f.piece} />
                    </td>
                    <td className={`${td} text-ink-body`}>{f.piece?.title ?? "Untitled"}</td>
                    <td className={`${td} text-ink-muted`}>
                      {f.purchase_currency !== "GBP" && f.purchase_cost != null
                        ? `Purchase ${f.purchase_cost} ${f.purchase_currency}`
                        : ""}
                      {f.sell_currency !== "GBP" && f.sold_price != null
                        ? `${f.purchase_currency !== "GBP" ? " · " : ""}Sale ${f.sold_price} ${f.sell_currency}`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-muted">None.</p>
        )}
      </section>

      {/* Other flagged rows (from the import issues log, if recorded) */}
      <section className="mt-8">
        <h2 className="text-[13px] font-semibold text-ink-strong">
          Other flagged rows ({flagged.length})
        </h2>
        {issueTally.size ? (
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {[...issueTally.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`)
              .join(" · ")}
          </p>
        ) : null}
        {flagged.length ? (
          <div className={box}>
            <table className="w-full min-w-[560px] bg-cell text-left">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  <th className={th}>Row</th>
                  <th className={th}>Stock</th>
                  <th className={th}>Issues</th>
                </tr>
              </thead>
              <tbody>
                {flagged.slice(0, 500).map((r) => (
                  <tr key={r.row_number} className="border-b border-line-soft last:border-0">
                    <td className={`${td} font-mono text-ink-muted`}>{r.row_number}</td>
                    <td className={td}>
                      <StockLink piece={r.piece} />
                    </td>
                    <td className={`${td} text-ink-muted`}>
                      {(r.issues as string[]).map((i) => i.replace(/_/g, " ")).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-muted">
            No per-row issue log recorded in the database.
          </p>
        )}
      </section>
    </div>
  );
}
