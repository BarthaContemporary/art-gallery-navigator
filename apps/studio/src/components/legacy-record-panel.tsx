import { createServiceClient } from "@/lib/supabase";

/**
 * The complete original FileMaker row for a piece, from the permanent
 * legacy_filemaker_rows.raw snapshot — so every imported value is visible even
 * if it wasn't promoted to a structured field. Admin/accountant only (raw may
 * contain financial columns).
 */
export async function LegacyRecordPanel({ pieceId }: { pieceId: string }) {
  const db = createServiceClient();
  const { data } = await db
    .from("legacy_filemaker_rows")
    .select("row_number, raw")
    .eq("piece_id", pieceId)
    .maybeSingle();
  if (!data) return null;

  const raw = (data as { row_number: number; raw: Record<string, unknown> }).raw ?? {};
  const entries = Object.entries(raw).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  );
  if (entries.length === 0) return null;

  return (
    <details className="mt-6 rounded-[11px] border border-line bg-cell p-5">
      <summary className="cursor-pointer text-[13px] font-semibold text-ink-strong">
        Original FileMaker record{" "}
        <span className="font-normal text-ink-muted">
          (row {(data as { row_number: number }).row_number} · {entries.length} fields)
        </span>
      </summary>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {entries.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
            <dt className="text-[10px] uppercase tracking-[0.06em] text-ink-faint">{k}</dt>
            <dd className="whitespace-pre-wrap break-words text-[12.5px] text-ink-body">
              {String(v)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
