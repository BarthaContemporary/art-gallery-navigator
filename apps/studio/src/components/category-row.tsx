"use client";

import { useState } from "react";

export type CategoryRow = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  pieces: number;
};

const cellInput =
  "w-full rounded-lg border border-line-control bg-control px-2.5 py-1.5 text-[13px] text-ink-body";

/**
 * One editable row in the Categories table.
 *
 * Three operations, deliberately distinct:
 *  · Edit — rename, or change the code.
 *  · Show/Hide — flips `is_active`. Hidden categories vanish from the pickers
 *    and filters but keep their pieces, which is how the legacy FileMaker
 *    categories were retired without touching the records that still use them.
 *  · Delete — permanent. Categories still holding pieces must nominate a
 *    category to move them into first; the server action does the move and the
 *    delete together.
 */
export function CategoryTableRow({
  cat,
  others,
  updateAction,
  toggleAction,
  deleteAction,
}: {
  cat: CategoryRow;
  others: { id: string; code: string; name: string }[];
  updateAction: (formData: FormData) => Promise<void>;
  toggleAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mergeTo, setMergeTo] = useState("");

  if (editing) {
    return (
      <tr className="border-b border-line-soft bg-band/40 last:border-0">
        <td colSpan={5} className="px-4 py-2.5">
          <form action={updateAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={cat.id} />
            <input
              name="name"
              defaultValue={cat.name}
              required
              className={`${cellInput} w-64`}
              aria-label="Category name"
            />
            <input
              name="code"
              defaultValue={cat.code}
              required
              className={`${cellInput} w-40 font-mono`}
              aria-label="Category code"
            />
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-fg"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[12px] text-ink-soft hover:text-ink-strong"
            >
              Cancel
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className={`border-b border-line-soft last:border-0 ${cat.is_active ? "" : "opacity-60"}`}>
        <td className="px-4 py-2.5 text-[13.5px] text-ink-body">{cat.name}</td>
        <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted">{cat.code}</td>
        <td className="px-4 py-2.5">
          {cat.is_active ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-body">
              <span
                aria-hidden
                className="inline-block h-[6px] w-[6px] rounded-full"
                style={{ background: "var(--jvb-status-green)" }}
              />
              In use
            </span>
          ) : (
            <span className="text-[12.5px] text-ink-muted">Hidden</span>
          )}
        </td>
        <td className="px-4 py-2.5">
          <a
            href={`/inventory?category=${cat.id}`}
            className="font-mono text-[12px] text-ink-mid underline"
          >
            {cat.pieces}
          </a>
        </td>
        <td className="px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12px] font-medium text-oranje hover:underline"
          >
            Edit
          </button>
          <form action={toggleAction} className="ml-3 inline">
            <input type="hidden" name="id" value={cat.id} />
            <input type="hidden" name="active" value={cat.is_active ? "0" : "1"} />
            <button type="submit" className="text-[12px] text-ink-soft hover:text-ink-strong">
              {cat.is_active ? "Hide" : "Show"}
            </button>
          </form>
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
            {cat.pieces === 0 ? (
              <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={cat.id} />
                <span className="text-[13px] text-ink-body">
                  Delete <strong>{cat.name}</strong>? No works use it — this cannot be undone.
                  If you only want it out of the pickers, use <strong>Hide</strong> instead.
                </span>
                <button
                  type="submit"
                  className="rounded-lg bg-tag-dark px-3 py-1.5 text-[12px] font-semibold text-primary-fg"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-[12px] text-ink-soft hover:text-ink-strong"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={cat.id} />
                <span className="text-[13px] text-ink-body">
                  <strong>{cat.name}</strong> is used by{" "}
                  <strong>
                    {cat.pieces} work{cat.pieces === 1 ? "" : "s"}
                  </strong>
                  . Move {cat.pieces === 1 ? "it" : "them"} to:
                </span>
                <select
                  name="merge_to"
                  required
                  value={mergeTo}
                  onChange={(e) => setMergeTo(e.target.value)}
                  className={`${cellInput} w-64`}
                >
                  <option value="" disabled>
                    Choose a category…
                  </option>
                  {others.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!mergeTo}
                  className="rounded-lg bg-tag-dark px-3 py-1.5 text-[12px] font-semibold text-primary-fg disabled:opacity-50"
                >
                  Move works &amp; delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="text-[12px] text-ink-soft hover:text-ink-strong"
                >
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
