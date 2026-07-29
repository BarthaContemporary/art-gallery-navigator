import { createDraftPiece } from "../actions";

export const metadata = { title: "New record" };

export default async function NewPiecePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ledger?: string }>;
}) {
  const { error, ledger } = await searchParams;
  // Arriving from the "Not JvdB" inventory view preselects that register, so
  // the choice carries through instead of resetting to JvdB stock.
  const external = ledger === "external";

  return (
    <div className="max-w-[560px]">
      <h1 className="text-[26px] font-semibold text-ink-strong">New record</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        A draft record is created straight away so everything you type is
        autosaved — and you can attach an import, export or temporary-export
        shipment while entering the work. The stock number is assigned now; an
        abandoned blank draft can be deleted from the record.
      </p>
      {error ? (
        <p className="mt-4 rounded-lg border border-line bg-band px-3 py-2 text-[12.5px] text-ink-body">
          {error}
        </p>
      ) : null}

      {/*
        The register is chosen before the draft exists, not afterwards: the
        stock number is assigned on insert, so a non-JvdB work picks up X-2026-
        numbering from the outset and never holds a JvdB number even briefly.
      */}
      <form action={createDraftPiece} className="mt-6">
        <fieldset className="rounded-[10px] border border-line p-4">
          <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-faint">
            Register
          </legend>

          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input
              type="radio"
              name="ledger"
              value="jvb"
              defaultChecked={!external}
              className="mt-[3px]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink-strong">
                JvdB stock
              </span>
              <span className="mt-0.5 block text-[12px] text-ink-soft">
                Our own stock. Numbered <span className="font-mono">2026-0001</span> and
                included in the Stock Book.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 py-1.5">
            <input
              type="radio"
              name="ledger"
              value="external"
              defaultChecked={external}
              className="mt-[3px]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink-strong">
                Not JvdB
              </span>
              <span className="mt-0.5 block text-[12px] text-ink-soft">
                Held in the gallery but someone else&rsquo;s property. Numbered{" "}
                <span className="font-mono">X-2026-0001</span> from the outset, and kept
                out of the Stock Book and every VAT figure.
              </span>
            </span>
          </label>
        </fieldset>

        <button
          type="submit"
          className="mt-5 rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-fg"
        >
          Start new record →
        </button>
      </form>

      <p className="mt-4 text-[12px] text-ink-soft">
        The register can be changed later from the record, which reissues the
        stock number. Moving a work back restores the number it had before.
      </p>
    </div>
  );
}
