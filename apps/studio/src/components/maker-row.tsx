"use client";

import { useState } from "react";

export type Maker = {
  id: string;
  display_name: string;
  native_name: string | null;
  life_dates: string | null;
  region: string | null;
  school_or_workshop: string | null;
};

const td = "px-4 py-2.5 align-middle";
const input =
  "w-full rounded-md border border-line-control bg-control px-2 py-1 text-[13px] text-ink-body";

/**
 * A single maker row that flips between a read view and an inline edit form.
 * Both Save and Delete post to server actions passed down from the page.
 */
export function MakerRow({
  maker,
  updateAction,
  deleteAction,
}: {
  maker: Maker;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <tr className="border-b border-line-soft bg-band/40 last:border-0">
        <td colSpan={6} className="px-4 py-3">
          <form
            action={updateAction}
            onSubmit={() => setEditing(false)}
            className="flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="id" value={maker.id} />
            {(
              [
                ["display_name", "Name", maker.display_name ?? ""],
                ["native_name", "Native", maker.native_name ?? ""],
                ["life_dates", "Dates", maker.life_dates ?? ""],
                ["region", "Region", maker.region ?? ""],
                ["school_or_workshop", "School / workshop", maker.school_or_workshop ?? ""],
              ] as [string, string, string][]
            ).map(([name, label, val]) => (
              <label
                key={name}
                className="block text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-faint"
              >
                {label}
                <input name={name} defaultValue={val} className={`mt-1 ${input}`} />
              </label>
            ))}
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-fg"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line-control bg-control px-3 py-2 text-[12px] font-medium text-ink-mid"
            >
              Cancel
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-line-soft last:border-0">
      <td className={`${td} text-[13.5px] text-ink-body`}>
        <a href={`/makers/${maker.id}`} className="hover:text-oranje" title="Open maker profile">
          {maker.display_name}
        </a>
      </td>
      <td className={`${td} text-[13.5px] text-ink-muted`}>{maker.native_name ?? "—"}</td>
      <td className={`${td} font-mono text-[12px] text-ink-muted`}>{maker.life_dates ?? "—"}</td>
      <td className={`${td} text-[13px] text-ink-muted`}>{maker.region ?? "—"}</td>
      <td className={`${td} text-[13px] text-ink-muted`}>{maker.school_or_workshop ?? "—"}</td>
      <td className={`${td} text-right`}>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[12px] font-medium text-[var(--jvb-ink-desc)] hover:text-ink-strong"
          >
            Edit
          </button>
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (
                !window.confirm(
                  `Delete “${maker.display_name}”? Any works by this maker will be left without a maker (they aren’t deleted).`,
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={maker.id} />
            <button type="submit" className="text-[12px] text-ink-soft hover:text-oranje">
              Delete
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
