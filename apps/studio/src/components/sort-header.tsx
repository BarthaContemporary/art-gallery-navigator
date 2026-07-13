"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Sortable column header. Single click sorts the whole list ascending by this
 * column; double click sorts descending. Sorting is server-side (the param
 * change re-runs the query and re-orders the full result set, not just the
 * visible page).
 */
export function SortHeader({
  column,
  label,
  align = "left",
}: {
  column: string;
  label: string;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSort = params.get("sort");
  const activeDir = (params.get("dir") ?? "asc") as "asc" | "desc";
  const isActive = activeSort === column;

  function navigate(dir: "asc" | "desc") {
    const p = new URLSearchParams(params.toString());
    p.set("sort", column);
    p.set("dir", dir);
    p.set("page", "1");
    router.push(`${pathname}?${p.toString()}`);
  }

  function handleClick() {
    // Defer the single-click so a double-click can pre-empt it.
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      navigate("asc");
    }, 220);
  }

  function handleDoubleClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    navigate("desc");
  }

  return (
    <th className={`px-4 py-2.5 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title="Click to sort ascending · double-click for descending"
        className={`inline-flex items-center gap-1 select-none hover:text-ink-mid ${
          isActive ? "text-ink-strong" : ""
        }`}
      >
        {label}
        <span aria-hidden className="font-mono text-[10px] text-ink-faint">
          {isActive ? (activeDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}
