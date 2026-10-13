import { createServiceClient } from "@/lib/supabase";
import { Section } from "@/components/ui/section";
import { formatCount } from "@/lib/format";

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

  // A titled section (so the editor's rail lists it), with the fields
  // folded away: they are rarely needed and run long.
  return (
    <Section
      title="Original FileMaker record"
      meta={`Row ${(data as { row_number: number }).row_number} · ${formatCount(entries.length)} fields`}
    >
      <details>
        <summary className="link w-fit cursor-pointer text-[12px]">Show the original fields</summary>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {entries.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-t border-rule py-1.5">
              <dt className="truncate text-[11.5px] font-semibold uppercase leading-[1.45] tracking-[0.06em] text-meta">{k}</dt>
              <dd className="whitespace-pre-wrap break-words text-[13px] leading-[1.45] text-body">
                {String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </Section>
  );
}
