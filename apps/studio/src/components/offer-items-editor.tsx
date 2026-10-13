"use client";

import { useRef, useState } from "react";
import { StatusPill } from "@/components/status-pill";
import { ReorderGrid } from "@/components/reorder-grid";
import { AmountInput } from "@/components/amount-input";
import { parseAmount } from "@/lib/amount";
import { Button } from "@/components/ui/button";

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
    return <p className="text-[13px] leading-[1.45] text-body">No works added yet. Find works below, or add a whole list.</p>;
  }

  return (
    <ReorderGrid
      order={items.map((it) => it.id)}
      onReorder={reorderItems}
      className="space-y-2"
      hint="Drag a grip, or focus it and press the arrow keys, to reorder the works."
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

  const priceId = `offer-item-price-${item.id}`;
  const noteId = `offer-item-note-${item.id}`;

  return (
    // pl-11 leaves room for the grip ReorderGrid lays over the row's left edge.
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2 border border-rule py-2.5 pl-11 pr-3">
      <div className="min-w-0 flex-1 basis-56 self-center">
        <p className="text-[13px] leading-[1.45] text-ink">
          <span className="tabular text-meta">{item.piece?.stock_number ?? "—"}</span>{" "}
          {item.piece?.title ?? "Untitled"}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-[12px] leading-[1.4] text-meta">
          <span>{[item.piece?.period, item.piece?.medium].filter(Boolean).join(" · ")}</span>
          {item.piece?.status ? <StatusPill status={item.piece.status} variant="inline" /> : null}
        </p>
      </div>
      <div className="flex w-24 flex-col gap-1">
        <label htmlFor={priceId} className="label">
          Price £
        </label>
        {/* A text field that accepts "12,000"; the page parses it with parseAmount. */}
        <AmountInput
          id={priceId}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => void save()}
          placeholder="Override"
          className="field field-sm tabular"
        />
      </div>
      <div className="flex w-40 flex-col gap-1">
        <label htmlFor={noteId} className="label">
          Note <span className="font-normal normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => void save()}
          className="field field-sm"
        />
      </div>
      <span
        aria-live="polite"
        className={`self-center text-[12px] text-ok transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
      >
        {saved ? "Saved" : ""}
      </span>
      <form action={removeItem} className="self-center">
        <input type="hidden" name="item_id" value={item.id} />
        <Button
          type="submit"
          variant="quiet"
          size="sm"
          pendingLabel="Removing…"
          aria-label={`Remove ${item.piece?.stock_number ?? item.piece?.title ?? "this work"} from the offer`}
        >
          Remove
        </Button>
      </form>
    </div>
  );
}
