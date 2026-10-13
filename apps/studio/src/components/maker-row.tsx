"use client";

import Link from "next/link";
import { useState } from "react";
import { scriptLang } from "@/lib/script-lang";
import { Td, Tr } from "@/components/ui/table";
import { WebsiteSwitch } from "@/components/ui/website-switch";
import { buttonClass } from "@/components/ui/button";

export type Maker = {
  id: string;
  display_name: string;
  native_name: string | null;
  life_dates: string | null;
  region: string | null;
  school_or_workshop: string | null;
  web_visible: boolean;
};

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
    <Tr>
      <Td>
        <Link href={`/makers/${maker.id}`} className="link-plain font-medium text-ink" title="Open maker profile">
          {maker.display_name}
        </Link>
      </Td>
      <Td lang={scriptLang(maker.native_name)} className="text-body">
        {maker.native_name ?? "—"}
      </Td>
      <Td className="tabular text-body">{maker.life_dates ?? "—"}</Td>
      <Td className="text-body">{maker.region ?? "—"}</Td>
      <Td className="text-body">{maker.school_or_workshop ?? "—"}</Td>
      <Td className="whitespace-nowrap">
        <WebsiteSwitch
          on={visible}
          pending={busy}
          onClick={toggleVisible}
          title={visible ? "Artist page is on the website. Select to take it off" : "Not on the website. Select to publish the artist page"}
        />
        {failed ? (
          <span role="alert" className="ml-2 text-[12px] text-danger">
            Couldn’t save
          </span>
        ) : null}
      </Td>
      <Td className="whitespace-nowrap text-right">
        <span className="inline-flex items-center justify-end gap-1">
          <Link href={`/makers/${maker.id}`} className="link px-1.5 text-[12px]">
            Edit
          </Link>
          <form
            action={deleteAction}
            className="inline-block"
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
            <button type="submit" className={buttonClass({ variant: "quiet", size: "sm" })}>
              Delete
            </button>
          </form>
        </span>
      </Td>
    </Tr>
  );
}
