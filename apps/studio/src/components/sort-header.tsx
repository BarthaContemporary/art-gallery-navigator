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
        <SortIcon state={isActive ? activeDir : "none"} />
      </button>
    </th>
  );
}

/**
 * Sort indicator — a paired up/down chevron drawn as monochrome SVG (not a
 * Unicode arrow, which iOS renders as a coloured emoji). The active direction
 * shows in full ink; the other is dimmed. Neutral state shows both faint.
 */
function SortIcon({ state }: { state: "asc" | "desc" | "none" }) {
  return (
    <svg
      aria-hidden
      width="7"
      height="11"
      viewBox="0 0 8 12"
      fill="none"
      className={`ml-0.5 ${state === "none" ? "text-ink-faint" : "text-ink-strong"}`}
    >
      <path
        d="M1.5 4.5 L4 2 L6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={state === "desc" ? 0.3 : 1}
      />
      <path
        d="M1.5 7.5 L4 10 L6.5 7.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={state === "asc" ? 0.3 : 1}
      />
    </svg>
  );
}
