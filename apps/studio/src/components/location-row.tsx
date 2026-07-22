"use client";

import { useState } from "react";

export type LocationRow = {
  id: string;
  code: string;
  name: string | null;
  type: string | null;
  pieces: number;
};

const TYPES = ["gallery", "storage", "fair", "restorer", "consignee", "auction", "other"];
const cellInput =
  "w-full rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[13px] text-ink-body";

/**
 * One editable row in the Locations table. Edit toggles inline inputs saved via
 * the update action. Delete: empty locations get a double-check confirm; a
 * location that still holds pieces asks which location to merge them into and
 * moves them first (server action handles the move + delete atomically).
 */
export function LocationTableRow({
  loc,
  others,
  updateAction,
  deleteAction,
}: {
  loc: LocationRow;
  others: { id: string; code: string; name: string | null }[];
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mergeTo, setMergeTo] = useState("");

  if (editing) {
    return (
      <tr className="border-b border-line-soft last:border-0 bg-band/40">
        <td colSpan={5} className="px-4 py-2.5">
          <form action={updateAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={loc.id} />
            <input name="code" defaultValue={loc.code} required className={`${cellInput} w-32 font-mono`} aria-label="Code" />
            <input name="name" defaultValue={loc.name ?? ""} placeholder="Name" className={`${cellInput} w-64`} aria-label="Name" />
            <select name="type" defaultValue={loc.type ?? "storage"} className={`${cellInput} w-36`} aria-label="Type">
              {TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg">
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-ink-soft hover:text-ink-strong">
              Cancel
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-line-soft last:border-0">
        <td className="px-4 py-2.5 font-mono text-[12px] text-ink">{loc.code}</td>
        <td className="px-4 py-2.5 text-[13.5px] text-ink-body">{loc.name}</td>
        <td className="px-4 py-2.5 text-[13px] text-ink-muted">{loc.type}</td>
        <td className="px-4 py-2.5">
          <a href={`/inventory?location=${loc.id}`} className="font-mono text-[12px] text-ink-mid underline">
            {loc.pieces}
          </a>
        </td>
        <td className="px-4 py-2.5 text-right">
          <button type="button" onClick={() => setEditing(true)} className="text-[12px] font-medium text-oranje hover:underline">
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirming((c) => !c)}
            className="ml-3 text-[12px] text-ink-soft hover:text-ink-strong"
          >
            Delete
          </button>
        </td>
      </tr>
      {confirming ? (
        <tr className="border-b border-line-soft bg-oranje/5 last:border-0">
          <td colSpan={5} className="px-4 py-3">
            {loc.pieces === 0 ? (
              <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={loc.id} />
                <span className="text-[13px] text-ink-body">
                  Delete location <strong>{loc.code}</strong>? It has no pieces attributed — this cannot be undone.
                </span>
                <button type="submit" className="rounded-lg bg-tag-dark px-3 py-1.5 text-[12px] font-semibold text-primary-fg">
                  Yes, delete
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="text-[12px] text-ink-soft hover:text-ink-strong">
                  Cancel
                </button>
              </form>
            ) : (
              <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={loc.id} />
                <span className="text-[13px] text-ink-body">
                  <strong>{loc.code}</strong> still holds{" "}
                  <strong>{loc.pieces} piece{loc.pieces === 1 ? "" : "s"}</strong>. Move them to:
                </span>
                <select
                  name="merge_to"
                  required
                  value={mergeTo}
                  onChange={(e) => setMergeTo(e.target.value)}
                  className={`${cellInput} w-64`}
                >
                  <option value="" disabled>Choose a location…</option>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code}{o.name ? ` · ${o.name}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!mergeTo}
                  className="rounded-lg bg-tag-dark px-3 py-1.5 text-[12px] font-semibold text-primary-fg disabled:opacity-50"
                >
                  Move pieces &amp; delete
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="text-[12px] text-ink-soft hover:text-ink-strong">
                  Cancel
                </button>
              </form>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
