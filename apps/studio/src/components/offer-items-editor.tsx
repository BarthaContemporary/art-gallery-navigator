"use client";

import { useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { ReorderGrid } from "@/components/reorder-grid";
import { AmountInput } from "@/components/amount-input";
import { parseAmount } from "@/lib/amount";

export type OfferItem = {
  id: string;
  price_override_gbp: number | null;
  note: string | null;
  piece: {
    stock_number: string | null;
    title: string | null;
    period: string | null;
    medium: string | null;
    /* Read live: an offer's membership is a snapshot, availability is not. */
    status?: string | null;
  } | null;
};

/**
 * Editable offer works list. Each row autosaves its price/note on blur (no
 * Save button to remember), and rows can be dragged to reorder — the new order
 * persists via the reorder action. Server actions are passed from the page.
 *
 * Reordering goes through ReorderGrid (a grip per row, Pointer Events, and
 * ← → on the focused grip). It used HTML5 draggable, which never fires on an
 * iPad and has no keyboard path, so the order could only be changed with a
 * mouse.
 */
export function OfferItemsEditor({
  items,
  updateItem,
  removeItem,
  reorderItems,
}: {
  items: OfferItem[];
  updateItem: (formData: FormData) => Promise<void>;
  removeItem: (formData: FormData) => Promise<void>;
  reorderItems: (orderedIds: string[]) => Promise<void>;
}) {
  if (items.length === 0) {
    return <p className="text-[13px] text-ink-muted">No works added yet.</p>;
  }

  return (
    <ReorderGrid
      order={items.map((it) => it.id)}
      onReorder={reorderItems}
      className="space-y-2"
      hint="Drag a grip to reorder, or focus it and use ← →."
      gripClassName="absolute left-2 top-1/2 z-20 -translate-y-1/2"
      showPosition={false}
      tiles={Object.fromEntries(
        items.map((it) => [
          it.id,
          <Row key={it.id} item={it} updateItem={updateItem} removeItem={removeItem} />,
        ]),
      )}
    />
  );
}

function Row({
  item,
  updateItem,
  removeItem,
}: {
  item: OfferItem;
  updateItem: (formData: FormData) => Promise<void>;
  removeItem: (formData: FormData) => Promise<void>;
}) {
  const [price, setPrice] = useState(item.price_override_gbp?.toString() ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [saved, setSaved] = useState(false);
  // Baseline of what's persisted, so blur only saves real changes.
  const persisted = useRef({ price, note });

  async function save() {
    // Compared as amounts: the field reformats "12000" to "12,000" on blur,
    // which is the same price and not worth a save.
    if (
      parseAmount(price) === parseAmount(persisted.current.price) &&
      note === persisted.current.note
    )
      return;
    const fd = new FormData();
    fd.set("item_id", item.id);
    fd.set("price_override_gbp", price.trim());
    fd.set("note", note.trim());
    await updateItem(fd);
    persisted.current = { price, note };
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    // pl-11 leaves room for the grip ReorderGrid lays over the row's left edge.
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft bg-cell py-2.5 pl-11 pr-4">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-ink-body">
          <span className="font-mono text-[12px] text-ink-muted">
            {item.piece?.stock_number ?? "—"}
          </span>{" "}
          {item.piece?.title ?? "Untitled"}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-soft">
          <span>{[item.piece?.period, item.piece?.medium].filter(Boolean).join(" · ")}</span>
          {item.piece?.status ? <StatusPill status={item.piece.status} variant="inline" /> : null}
        </p>
      </div>
      <label className="text-[11px] text-ink-faint">
        Price £
        {/* A text field that accepts "12,000"; the page parses it with parseAmount. */}
        <AmountInput
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => void save()}
          placeholder="override"
          className="ml-1 w-24 rounded-md border border-line-control bg-control px-2 py-1 font-mono text-[12px]"
        />
      </label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => void save()}
        placeholder="note (optional)"
        className="w-40 rounded-md border border-line-control bg-control px-2 py-1 text-[12px]"
      />
      <span
        className={`text-[11px] text-status-green transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
      >
        saved
      </span>
      <form action={removeItem}>
        <input type="hidden" name="item_id" value={item.id} />
        <button type="submit" className="text-[12px] text-ink-soft hover:text-ink-strong">
          Remove
        </button>
      </form>
    </div>
  );
}
