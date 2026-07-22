"use client";

export type Maker = {
  id: string;
  display_name: string;
  native_name: string | null;
  life_dates: string | null;
  region: string | null;
  school_or_workshop: string | null;
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
