/*
 * Tables (spec section 4): the studio's main surface, so one structure for
 * all of them. Native <table> elements with shared classes; nothing here
 * holds state.
 *
 *   <TableFrame bordered? className?>   the scrolling wrapper. Carries
 *     data-inset-focus, so the focus ring draws inside cells instead of being
 *     clipped by the overflow. bordered adds a 1px rule-strong box.
 *   <Table className?>                  <table>: full width, collapsed
 *     borders, 13px. Add style={{ tableLayout: "fixed", width }} for
 *     resizable columns.
 *   <Th sort? onSort? sortHref? numeric? sticky? …th props>
 *     A head cell in the label style over a rule-strong underline.
 *       sort      "asc" | "desc" | "none" makes the head sortable and sets
 *                 aria-sort; leave it out for a plain head.
 *       sortHref  sort by URL (server pages: keep the other query
 *                 parameters in it); onSort for client-side sorting.
 *       numeric   right-aligned, for money and counts.
 *       sticky    sticks under the app header (var(--app-header-h)).
 *   <Td numeric? …td props>             a cell on a rule hairline, padded by
 *     --jvb-row-py (10px, 6px in compact density). numeric: right-aligned,
 *     tabular figures.
 *   <Tr selected? flagged? current? …tr props>  a body row with the shared
 *     states: hover band; selected accent wash with a 2px accent rule;
 *     current (the j/k keyboard row) band with the accent rule; flagged a
 *     3px warn rule. rowClass({ … }) gives the same classes for a <tr> you
 *     build yourself.
 *   <EmptyRow colSpan action?>{sentence}</EmptyRow>  the one empty row: a
 *     sentence and one next action.
 *   <ColumnResizer {...handleProps} />  the drag handle at a head's right
 *     edge; props from hooks/use-resizable-columns. Put it in a
 *     `relative` <th>.
 *   <SortMark state />                  the sort glyph on its own.
 *
 * Server-safe, except that onSort and ColumnResizer take handlers and so
 * belong in client components.
 */
import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cx } from "./cx";
import { ChevronDownIcon, ChevronUpIcon, SortIcon } from "./icons";

export function TableFrame({
  bordered = false,
  className,
  children,
  ...rest
}: ComponentPropsWithRef<"div"> & { bordered?: boolean }) {
  return (
    <div {...rest} data-inset-focus className={cx("overflow-x-auto", bordered && "border border-rule-strong", className)}>
      {children}
    </div>
  );
}

export function Table({ className, ...rest }: ComponentPropsWithRef<"table">) {
  return <table {...rest} className={cx("w-full border-collapse text-left text-[13px] leading-[1.45]", className)} />;
}

export type SortState = "asc" | "desc" | "none";

export function SortMark({ state }: { state: SortState }) {
  if (state === "asc") return <ChevronUpIcon size={12} className="shrink-0 text-ink" />;
  if (state === "desc") return <ChevronDownIcon size={12} className="shrink-0 text-ink" />;
  return <SortIcon size={12} className="shrink-0 text-light" />;
}

const ARIA_SORT = { asc: "ascending", desc: "descending", none: "none" } as const;

export function Th({
  sort,
  onSort,
  sortHref,
  numeric = false,
  sticky = false,
  className,
  style,
  children,
  ...rest
}: ComponentPropsWithRef<"th"> & {
  sort?: SortState;
  onSort?: () => void;
  sortHref?: string;
  numeric?: boolean;
  sticky?: boolean;
}) {
  const sortable = sort !== undefined;
  const control = cx(
    "inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-ink",
    sort && sort !== "none" && "text-ink",
  );
  // The words take the baseline (self-baseline), so a sortable head lines
  // up with a plain one whichever side its mark is on. On a numeric column
  // the mark goes first, keeping the words flush with the figures below.
  const inner = sortable ? (
    <>
      {numeric ? <SortMark state={sort} /> : null}
      <span className="self-baseline">{children}</span>
      {numeric ? null : <SortMark state={sort} />}
    </>
  ) : null;
  return (
    <th
      scope="col"
      {...rest}
      aria-sort={sortable ? ARIA_SORT[sort] : undefined}
      style={sticky ? { top: "var(--app-header-h, 88px)", ...style } : style}
      className={cx(
        "whitespace-nowrap border-b border-rule-strong bg-page px-3 py-2 align-bottom text-[11.5px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-meta",
        numeric ? "text-right" : "text-left",
        sticky && "sticky z-10",
        className,
      )}
    >
      {sortable && sortHref ? (
        <Link href={sortHref} className={control}>
          {inner}
        </Link>
      ) : sortable && onSort ? (
        <button type="button" onClick={onSort} className={control}>
          {inner}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export function Td({ numeric = false, className, ...rest }: ComponentPropsWithRef<"td"> & { numeric?: boolean }) {
  return (
    <td
      {...rest}
      className={cx(
        "border-b border-rule px-3 py-[var(--jvb-row-py)] align-middle",
        numeric && "tabular text-right",
        className,
      )}
    />
  );
}

export type RowState = { selected?: boolean; flagged?: boolean; current?: boolean };

export function rowClass({ selected, flagged, current }: RowState = {}, className?: string): string {
  return cx("tbl-row", selected && "is-selected", flagged && "is-flagged", current && "is-current", className);
}

export function Tr({
  selected,
  flagged,
  current,
  className,
  ...rest
}: ComponentPropsWithRef<"tr"> & RowState) {
  return <tr {...rest} className={rowClass({ selected, flagged, current }, className)} />;
}

export function EmptyRow({
  colSpan,
  action,
  children,
}: {
  colSpan: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-b border-rule px-3 py-10 text-center">
        <p className="mx-auto max-w-[46ch] text-[13px] leading-[1.45] text-body">{children}</p>
        {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
      </td>
    </tr>
  );
}

/**
 * The column-resize handle: a 16px hit area at the head's right edge with a
 * 2px divider that turns orange on hover and keyboard focus. Spread the
 * props from useResizableColumns().handleProps(key, label).
 */
export function ColumnResizer(props: ComponentPropsWithRef<"span">) {
  return (
    <span
      {...props}
      className="group absolute inset-y-0 right-0 z-20 w-4 cursor-col-resize touch-none"
    >
      <span className="pointer-events-none absolute inset-y-[5px] right-0 w-[2px] rounded bg-line-control transition-colors group-hover:bg-oranje group-focus-visible:bg-oranje" />
    </span>
  );
}
