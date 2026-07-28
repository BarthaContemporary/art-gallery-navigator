"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STATUS_LABELS } from "@/components/status-pill";

type Option = { id: string; name: string };

const select =
  "rounded-lg border border-line-control bg-control px-2.5 py-2 text-[12.5px] text-ink-mid";

/**
 * Client filter bar for the inventory list. Selects apply the moment they
 * change; the search box applies on a short debounce. Every change resets to
 * page 1 and preserves the active sort. No "Filter" button — the list reacts
 * as you go (Apple + Impeccable both flagged the submit-to-see-results delay).
 */
export function InventoryFilters({
  categories,
  locations,
  lists,
}: {
  categories: Option[];
  locations: Option[];
  lists: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the box in sync when the URL changes underneath us (chip removal,
  // back/forward) without clobbering what the user is mid-type.
  const urlQ = params.get("q") ?? "";
  const lastPushed = useRef(urlQ);
  useEffect(() => {
    if (urlQ !== lastPushed.current) {
      setQ(urlQ);
      lastPushed.current = urlQ;
    }
  }, [urlQ]);

  function pushWith(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page"); // any filter change returns to the first page
    const qs = next.toString();
    lastPushed.current = next.get("q") ?? "";
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function setParam(key: string, value: string) {
    pushWith((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setParam("q", value.trim());
    }, 350);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounce.current) clearTimeout(debounce.current);
    setParam("q", q.trim());
  }

  return (
    <form
      className="mt-4 flex flex-wrap items-center gap-2"
      onSubmit={onSearchSubmit}
      role="search"
    >
      <input
        type="search"
        value={q}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search stock no., title, maker…"
        aria-label="Search inventory"
        className="w-full min-w-0 rounded-lg border border-line-control bg-control px-3 py-2 text-[13.5px] sm:w-72"
      />
      <select
        aria-label="Filter by register"
        value={params.get("ledger") ?? ""}
        onChange={(e) => setParam("ledger", e.target.value)}
        className={select}
        title="JvdB stock is shown by default; non-JvdB works are held like stock but are not JvdB property"
      >
        <option value="">JvdB stock</option>
        <option value="external">Not JvdB</option>
        <option value="all">Both registers</option>
      </select>
      <select
        aria-label="Filter by status"
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className={select}
      >
        <option value="">All statuses</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by category"
        value={params.get("category") ?? ""}
        onChange={(e) => setParam("category", e.target.value)}
        className={select}
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by location"
        value={params.get("location") ?? ""}
        onChange={(e) => setParam("location", e.target.value)}
        className={select}
      >
        <option value="">All locations</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by list"
        value={params.get("list") ?? ""}
        onChange={(e) => setParam("list", e.target.value)}
        className={select}
      >
        <option value="">All lists</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <span
        aria-live="polite"
        className={`text-[11px] font-medium text-ink-faint transition-opacity ${
          pending ? "opacity-100" : "opacity-0"
        }`}
      >
        Updating…
      </span>
    </form>
  );
}
