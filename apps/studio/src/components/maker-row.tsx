"use client";

import { useState } from "react";

export type Maker = {
  id: string;
  display_name: string;
  native_name: string | null;
  life_dates: string | null;
  region: string | null;
  school_or_workshop: string | null;
  web_visible: boolean;
};

const td = "px-4 py-2.5 align-middle";

/**
 * A single maker row. All editing happens on the maker profile page (the one
 * editing panel — details, portrait, rich profile), so Edit is a link there;
 * Delete stays inline with a confirm.
 */
export function MakerRow({
  maker,
  deleteAction,
}: {
  maker: Maker;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  // Website switch — the same flag the profile page edits; the database
  // pushes the artist page to the site (or withdraws it) as soon as it saves.
  const [visible, setVisible] = useState(maker.web_visible);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function toggleVisible() {
    const next = !visible;
    setVisible(next);
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/makers/${maker.id}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ webVisible: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setVisible(!next);
      setFailed(true);
    } finally {
      setBusy(false);
    }
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
      <td className={`${td} whitespace-nowrap`}>
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          disabled={busy}
          onClick={toggleVisible}
          title={visible ? "Artist page is on the website — click to take it off" : "Not on the website — click to publish the artist page"}
          className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[12px] font-medium disabled:opacity-60 ${
            visible ? "border-status-green/60 bg-control text-ink-mid" : "border-line-control bg-control text-ink-muted"
          }`}
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: visible ? "var(--jvb-status-green)" : "var(--jvb-danger)" }}
          />
          {visible ? "On website" : "Off"}
        </button>
        {failed ? <span className="ml-2 text-[11px] text-oranje">Couldn’t save</span> : null}
      </td>
      <td className={`${td} whitespace-nowrap text-right`}>
        <a
          href={`/makers/${maker.id}`}
          className="inline-block align-middle text-[12px] font-medium leading-none text-[var(--jvb-ink-desc)] hover:text-ink-strong"
        >
          Edit
        </a>
        <form
          action={deleteAction}
          className="ml-3 inline-block align-middle"
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
          <button type="submit" className="text-[12px] leading-none text-ink-soft hover:text-oranje">
            Delete
          </button>
        </form>
      </td>
    </tr>
  );
}
