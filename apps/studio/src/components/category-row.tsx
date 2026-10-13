"use client";

import Link from "next/link";
import { useState } from "react";
import { ReorderHandle } from "@/components/reorder-grid";
import { formatCount } from "@/lib/format";
import { Td, Tr } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";

export type CategoryRow = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  pieces: number;
};

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
  reorderable = false,
  others,
  updateAction,
  toggleAction,
  deleteAction,
}: {
  cat: CategoryRow;
  /** Admin only — shows the drag grip. */
  reorderable?: boolean;
  others: { id: string; code: string; name: string }[];
  updateAction: (formData: FormData) => Promise<void>;
  toggleAction: (formData: FormData) => Promise<void>;
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
            <input type="hidden" name="id" value={cat.id} />
            <div className="flex flex-col gap-1">
              <label htmlFor={`cat-name-${cat.id}`} className="label">
                Name
              </label>
              <input id={`cat-name-${cat.id}`} name="name" defaultValue={cat.name} required className="field field-sm w-64" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`cat-code-${cat.id}`} className="label">
                Code
              </label>
              <input id={`cat-code-${cat.id}`} name="code" defaultValue={cat.code} required className="field field-sm tabular w-40" />
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
            <ReorderHandle id={cat.id} />
          </Td>
        ) : null}
        <Td className={cat.is_active ? "font-medium text-ink" : "text-body"}>{cat.name}</Td>
        <Td className="tabular whitespace-nowrap text-body">{cat.code}</Td>
        <Td>
          {cat.is_active ? (
            <Badge tone="ok" variant="dot">
              In use
            </Badge>
          ) : (
            <Badge variant="dot" hollow>
              Hidden
            </Badge>
          )}
        </Td>
        <Td numeric>
          {/* Underlined at rest so it reads as a link, not a bare figure. */}
          <Link
            href={`/inventory?category=${cat.id}&ledger=all`}
            className="link-plain text-ink underline decoration-meta underline-offset-2 hover:decoration-ink"
            title={`Show the ${cat.pieces === 1 ? "work" : "works"} in ${cat.name}`}
            aria-label={`Show ${formatCount(cat.pieces)} ${cat.pieces === 1 ? "work" : "works"} in ${cat.name} in the inventory`}
          >
            {formatCount(cat.pieces)}
          </Link>
        </Td>
        <Td className="whitespace-nowrap text-right">
          <span className="inline-flex items-center gap-1">
            {/* Ink, not the link orange: beside the red Delete the two read as one colour. */}
            <Button size="sm" variant="quiet" onClick={() => setEditing(true)} className="text-body hover:text-ink">
              Edit
            </Button>
            <form action={toggleAction} className="inline">
              <input type="hidden" name="id" value={cat.id} />
              <input type="hidden" name="active" value={cat.is_active ? "0" : "1"} />
              <Button type="submit" size="sm" variant="quiet">
                {cat.is_active ? "Hide" : "Show"}
              </Button>
            </form>
            {/* A row's destructive action: quiet, in the danger colour. */}
            <Button
              size="sm"
              variant="quiet"
              aria-expanded={confirming}
              onClick={() => setConfirming((c) => !c)}
              className="text-danger"
            >
              Delete
            </Button>
          </span>
        </Td>
      </Tr>

      {confirming ? (
        <tr>
          <td colSpan={span} className="border-b border-rule p-0">
            <Notice tone="danger">
              {cat.pieces === 0 ? (
                <form action={deleteAction} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={cat.id} />
                  <span className="text-[13px] text-body">
                    Delete <strong className="text-ink">{cat.name}</strong>? No works use it. This cannot be undone.
                    If you only want it out of the pickers, use <strong className="text-ink">Hide</strong> instead.
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
                  <input type="hidden" name="id" value={cat.id} />
                  <label htmlFor={`cat-merge-${cat.id}`} className="text-[13px] text-body">
                    <strong className="text-ink">{cat.name}</strong> is used by{" "}
                    <strong className="text-ink">
                      {cat.pieces} work{cat.pieces === 1 ? "" : "s"}
                    </strong>
                    . Move {cat.pieces === 1 ? "it" : "them"} to:
                  </label>
                  <select
                    id={`cat-merge-${cat.id}`}
                    name="merge_to"
                    required
                    value={mergeTo}
                    onChange={(e) => setMergeTo(e.target.value)}
                    className="field field-sm w-64"
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
                  <Button type="submit" size="sm" variant="danger" disabled={!mergeTo} pendingLabel="Moving…">
                    Move works and delete
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
