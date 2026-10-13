"use client";

import Link from "next/link";
import { useState } from "react";
import { ReorderHandle } from "@/components/reorder-grid";
import { formatCount } from "@/lib/format";
import { LOCATION_TYPE_LABELS, labelOf, locationLabel } from "@/lib/labels";
import { Td, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export type LocationRow = {
  id: string;
  code: string;
  name: string | null;
  type: string | null;
  pieces: number;
};

const TYPES = ["gallery", "storage", "fair", "restorer", "consignee", "auction", "other"];

const typeLabel = (t: string | null) => (t ? labelOf(LOCATION_TYPE_LABELS, t) : "—");

/**
 * One editable row in the Locations table. Edit toggles inline inputs saved via
 * the update action. Delete: empty locations get a double-check confirm; a
 * location that still holds pieces asks which location to merge them into and
 * moves them first (server action handles the move + delete atomically).
 */
export function LocationTableRow({
  loc,
  reorderable = false,
  others,
  updateAction,
  deleteAction,
}: {
  loc: LocationRow;
  /** Admin only — shows the drag grip. */
  reorderable?: boolean;
  others: { id: string; code: string; name: string | null }[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mergeTo, setMergeTo] = useState("");
  // colSpan follows the admin grip column, which only exists for admins.
  const span = reorderable ? 6 : 5;

  if (editing) {
    return (
      <Tr current>
        <Td colSpan={span}>
          <form action={updateAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={loc.id} />
            <div className="flex flex-col gap-1">
              <label htmlFor={`loc-code-${loc.id}`} className="label">
                Code
              </label>
              <input id={`loc-code-${loc.id}`} name="code" defaultValue={loc.code} required className="field field-sm tabular w-32" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`loc-name-${loc.id}`} className="label">
                Name
              </label>
              <input id={`loc-name-${loc.id}`} name="name" defaultValue={loc.name ?? ""} className="field field-sm w-64" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`loc-type-${loc.id}`} className="label">
                Type
              </label>
              <select id={`loc-type-${loc.id}`} name="type" defaultValue={loc.type ?? "storage"} className="field field-sm w-36">
                {TYPES.map((t) => (
                  <option key={t} value={t}>{typeLabel(t)}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" variant="primary" pendingLabel="Saving…">
              Save
            </Button>
            <Button size="sm" variant="quiet" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </form>
        </Td>
      </Tr>
    );
  }

  return (
    <>
      <Tr>
        {/* Grip lives in its own cell — a table row has nowhere to overlay it. */}
        {reorderable ? (
          <Td className="w-10">
            <ReorderHandle id={loc.id} />
          </Td>
        ) : null}
        <Td className="tabular whitespace-nowrap font-medium text-ink">{loc.code}</Td>
        <Td className="text-ink">{loc.name}</Td>
        <Td className="text-body">{typeLabel(loc.type)}</Td>
        <Td numeric>
          {/* Both registers: the count includes works not owned by JvdB. */}
          <Link
            href={`/inventory?location=${loc.id}&ledger=all`}
            className="link-plain text-ink underline decoration-rule-strong underline-offset-2"
            title={`Show the ${loc.pieces === 1 ? "work" : "works"} at ${locationLabel(loc)}`}
          >
            {formatCount(loc.pieces)}
          </Link>
        </Td>
        <Td className="whitespace-nowrap text-right">
          <span className="inline-flex items-center gap-1">
            <button type="button" onClick={() => setEditing(true)} className="link px-1.5 text-[12px]">
              Edit
            </button>
            <Button size="sm" variant="quiet" aria-expanded={confirming} onClick={() => setConfirming((c) => !c)}>
              Delete
            </Button>
          </span>
        </Td>
      </Tr>
      {confirming ? (
        <tr>
          <td colSpan={span} className="border-b border-rule p-0">
            <Notice tone="danger">
              {loc.pieces === 0 ? (
                <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={loc.id} />
                  <span className="text-[13px] text-body">
                    Delete location <strong className="text-ink">{loc.code}</strong>? It has no pieces attributed. This
                    cannot be undone.
                  </span>
                  <Button type="submit" size="sm" variant="danger" pendingLabel="Deleting…">
                    Yes, delete
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={loc.id} />
                  <label htmlFor={`loc-merge-${loc.id}`} className="text-[13px] text-body">
                    <strong className="text-ink">{loc.code}</strong> still holds{" "}
                    <strong className="text-ink">
                      {loc.pieces} piece{loc.pieces === 1 ? "" : "s"}
                    </strong>
                    . Move them to:
                  </label>
                  <select
                    id={`loc-merge-${loc.id}`}
                    name="merge_to"
                    required
                    value={mergeTo}
                    onChange={(e) => setMergeTo(e.target.value)}
                    className="field field-sm w-64"
                  >
                    <option value="" disabled>Choose a location…</option>
                    {others.map((o) => (
                      <option key={o.id} value={o.id}>
                        {locationLabel(o)}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="danger" disabled={!mergeTo} pendingLabel="Moving…">
                    Move pieces and delete
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </form>
              )}
            </Notice>
          </td>
        </tr>
      ) : null}
    </>
  );
}
