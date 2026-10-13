import { createDraftPiece } from "../actions";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ArrowRightIcon } from "@/components/ui/icons";

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
    <div className="max-w-[640px]">
      <PageHeader back={{ href: "/inventory", label: "Inventory" }} title="New record">
        <p className="text-[13px] leading-[1.45] text-body">
          A draft record is created straight away, so everything you type is autosaved, and you
          can attach an import, export or temporary-export shipment while entering the work. The
          stock number is assigned now; an abandoned blank draft can be deleted from the record.
        </p>
      </PageHeader>

      {error ? (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      ) : null}

      {/*
        The register is chosen before the draft exists, not afterwards: the
        stock number is assigned on insert, so a non-JvdB work picks up X-2026-
        numbering from the outset and never holds a JvdB number even briefly.
      */}
      <form action={createDraftPiece}>
        {/* The rule is on a wrapper: on the fieldset itself the legend would
            sit in the line, as browsers draw legends. */}
        <div className="border-t border-rule-strong pt-3">
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className="label mb-1 p-0">Register</legend>

            <label className="flex cursor-pointer items-start gap-2.5 border-b border-rule py-3">
              <input
                type="radio"
                name="ledger"
                value="jvb"
                defaultChecked={!external}
                className="mt-[3px] h-4 w-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium leading-[1.45] text-ink">JvdB stock</span>
                <span className="mt-0.5 block text-[12px] leading-[1.4] text-meta">
                  Our own stock. Numbered <span className="tabular">2026-0001</span> and included in the
                  Stock Book.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2.5 border-b border-rule py-3">
              <input
                type="radio"
                name="ledger"
                value="external"
                defaultChecked={external}
                className="mt-[3px] h-4 w-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium leading-[1.45] text-ink">Not JvdB</span>
                <span className="mt-0.5 block text-[12px] leading-[1.4] text-meta">
                  Held in the gallery but someone else&rsquo;s property. Numbered{" "}
                  <span className="tabular">X-2026-0001</span> from the outset, and kept out of the
                  Stock Book and every VAT figure.
                </span>
              </span>
            </label>
          </fieldset>
        </div>

        <Button type="submit" variant="primary" pendingLabel="Starting…" className="mt-5">
          Start new record
          <ArrowRightIcon size={14} />
        </Button>
      </form>

      <p className="mt-4 text-[12px] leading-[1.4] text-meta">
        The register can be changed later from the record, which reissues the stock number. Moving
        a work back restores the number it had before.
      </p>
    </div>
  );
}
