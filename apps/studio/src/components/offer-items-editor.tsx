"use client";

import { useEffect, useRef, useState } from "react";

export type OfferItem = {
  id: string;
  price_override_gbp: number | null;
  note: string | null;
  piece: {
    stock_number: string | null;
    title: string | null;
    period: string | null;
    medium: string | null;
  } | null;
};

/**
 * Editable offer works list. Each row autosaves its price/note on blur (no
 * Save button to remember), and rows can be dragged to reorder — the new order
 * persists via the reorder action. Server actions are passed from the page.
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
  const [order, setOrder] = useState(items);
  const dragId = useRef<string | null>(null);

  useEffect(() => setOrder(items), [items]);

  function onDrop(targetId: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    const next = [...order];
    const fromIdx = next.findIndex((i) => i.id === from);
    const toIdx = next.findIndex((i) => i.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    setOrder(next);
    void reorderItems(next.map((i) => i.id));
  }

  if (order.length === 0) {
    return <p className="text-[13px] text-ink-muted">No works added yet.</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      {order.map((it) => (
        <Row
          key={it.id}
          item={it}
          updateItem={updateItem}
          removeItem={removeItem}
          onDragStart={() => (dragId.current = it.id)}
          onDrop={() => onDrop(it.id)}
        />
      ))}
    </div>
  );
}

function Row({
  item,
  updateItem,
  removeItem,
  onDragStart,
  onDrop,
}: {
  item: OfferItem;
  updateItem: (formData: FormData) => Promise<void>;
  removeItem: (formData: FormData) => Promise<void>;
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const [price, setPrice] = useState(item.price_override_gbp?.toString() ?? "");
  const [note, setNote] = useState(item.note ?? "");
  const [saved, setSaved] = useState(false);
  // Baseline of what's persisted, so blur only saves real changes.
  const persisted = useRef({ price, note });

  async function save() {
    if (price === persisted.current.price && note === persisted.current.note) return;
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
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft bg-cell px-4 py-2.5"
    >
      <span
        aria-hidden
        title="Drag to reorder"
        className="cursor-grab select-none text-ink-faint active:cursor-grabbing"
      >
        ⠿
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] text-ink-body">
          <span className="font-mono text-[12px] text-ink-muted">
            {item.piece?.stock_number ?? "—"}
          </span>{" "}
          {item.piece?.title ?? "Untitled"}
        </p>
        <p className="text-[12px] text-ink-soft">
          {[item.piece?.period, item.piece?.medium].filter(Boolean).join(" · ")}
        </p>
      </div>
      <label className="text-[11px] text-ink-faint">
        Price £
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => void save()}
          inputMode="numeric"
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
