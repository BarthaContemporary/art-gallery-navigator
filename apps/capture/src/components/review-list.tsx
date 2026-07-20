"use client";

import Link from "next/link";
import { useState } from "react";
import { SwipeToDelete } from "@/components/swipe-to-delete";

export type BatchRow = { id: string; name: string; date: string; count: number };

/** Draft purchase batches — tap to review, swipe left to delete the whole batch. */
export function ReviewList({ batches }: { batches: BatchRow[] }) {
  const [rows, setRows] = useState<BatchRow[]>(batches);

  async function remove(id: string) {
    setRows((r) => r.filter((b) => b.id !== id));
    await fetch(`/api/capture/batch/${id}`, { method: "DELETE" });
  }

  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-line-control bg-cell px-4 py-8 text-center text-[13px] text-ink-soft">
        Nothing waiting. Capture some works first.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11.5px] text-ink-soft">Swipe a purchase left to delete it.</p>
      <div className="space-y-2">
        {rows.map((b) => (
          <SwipeToDelete
            key={b.id}
            confirmText={`Delete the whole purchase “${b.name}” (${b.count} work(s)) and its photos?`}
            onDelete={() => remove(b.id)}
          >
            <Link
              href={`/review/${b.id}`}
              className="tap flex items-center justify-between gap-3 rounded-2xl border border-line bg-cell px-4 py-3.5 active:bg-control/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-ink-strong">{b.name}</span>
                <span className="block text-[12px] text-ink-muted">
                  {b.date} · {b.count} work(s)
                </span>
              </span>
              <span className="shrink-0 text-ink-soft">›</span>
            </Link>
          </SwipeToDelete>
        ))}
      </div>
    </div>
  );
}
