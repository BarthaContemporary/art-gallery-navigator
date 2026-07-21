import { createDraftPiece } from "../actions";

export const metadata = { title: "New record" };

export default async function NewPiecePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
      <form action={createDraftPiece} className="mt-6">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-fg"
        >
          Start new record →
        </button>
      </form>
    </div>
  );
}
