"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STATUS_LABELS } from "@/components/status-pill";
import { Field, Input, Select } from "@/components/ui/field";
import { ToggleChip } from "@/components/ui/chips";
import { FlagIcon } from "@/components/ui/icons";

type Option = { id: string; name: string };

/**
 * Client filter bar for the inventory list. Selects and chips apply the
 * moment they change; the search box applies on a short debounce. Every
 * change resets to page 1 and keeps every other parameter, the sort included.
 * No "Filter" button: the list reacts as you go (Apple + Impeccable both
 * flagged the submit-to-see-results delay).
 *
 * The chips are the boolean filters: the user's own flags, then the three
 * "show only…" flags (FLAG_FILTERS in lib/inventory-query, passed in so this
 * client bundle does not pull the query helpers). Each toggles its own
 * parameter and nothing else, as the facets do.
 */
export function InventoryFilters({
  categories,
  locations,
  lists,
  flags,
  flaggedCount,
}: {
  categories: Option[];
  locations: Option[];
  lists: Option[];
  /** URL parameter and chip label of each "show only…" flag. */
  flags: { param: string; label: string }[];
  /** How many works the current user has flagged, shown on the Flagged chip. */
  flaggedCount: number;
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

  /** A boolean filter: "1" when on, absent when off. */
  function toggleParam(key: string) {
    setParam(key, params.get(key) ? "" : "1");
  }

  /**
   * A facet param holds either "value" (include) or "!value" (exclude). The
   * toggle flips the prefix; changing the value keeps the current mode.
   */
  function facetOf(key: string): { value: string; exclude: boolean } {
    const raw = params.get(key) ?? "";
    return raw.startsWith("!")
      ? { value: raw.slice(1), exclude: true }
      : { value: raw, exclude: false };
  }
  function setFacetValue(key: string, value: string) {
    const { exclude } = facetOf(key);
    setParam(key, value ? (exclude ? `!${value}` : value) : "");
  }
  function toggleFacetMode(key: string) {
    const { value, exclude } = facetOf(key);
    if (!value) return;
    setParam(key, exclude ? value : `!${value}`);
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

  /**
   * The "is / not" switch before a facet select; disabled until a value is
   * set. Pressed means excluding, and the word changes with it.
   */
  const modeToggle = (key: string, label: string) => {
    const { value, exclude } = facetOf(key);
    return (
      <ToggleChip
        pressed={exclude}
        onClick={() => toggleFacetMode(key)}
        disabled={!value}
        aria-label={`${label}: ${exclude ? "excluding" : "including"}. Switch to ${exclude ? "including" : "excluding"}`}
        title={
          value
            ? exclude
              ? "Excluding: showing everything except this. Click to include."
              : "Including: showing only this. Click to exclude."
            : "Pick a value first, then switch between include and exclude"
        }
        className="w-10 shrink-0 justify-center px-0"
      >
        {exclude ? "not" : "is"}
      </ToggleChip>
    );
  };

  const flagged = Boolean(params.get("flagged"));

  return (
    <form className="space-y-3" onSubmit={onSearchSubmit} role="search" aria-label="Filter inventory">
      {/* Two to a row on a phone, one wrapping row from sm up; the search box
          takes what the facets leave. */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-3 sm:flex sm:flex-wrap sm:items-end">
        <Field label="Search" className="col-span-2 sm:min-w-[14rem] sm:flex-[1_1_16rem] sm:max-w-sm">
          <Input
            type="search"
            fieldSize="sm"
            value={q}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Stock no., title, maker…"
          />
        </Field>
        <Field label="Register" className="sm:w-36">
          <Select
            fieldSize="sm"
            value={params.get("ledger") ?? ""}
            onChange={(e) => setParam("ledger", e.target.value)}
            title="JvdB stock is shown by default; non-JvdB works are held like stock but are not JvdB property"
          >
            <option value="">JvdB stock</option>
            <option value="external">Not JvdB</option>
            <option value="all">Both registers</option>
          </Select>
        </Field>
        <Field label="Status" className="sm:w-48">
          <span className="flex gap-1">
            {modeToggle("status", "Status")}
            <Select
              fieldSize="sm"
              value={facetOf("status").value}
              onChange={(e) => setFacetValue("status", e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </span>
        </Field>
        <Field label="Category" className="sm:w-52">
          <span className="flex gap-1">
            {modeToggle("category", "Category")}
            <Select
              fieldSize="sm"
              value={facetOf("category").value}
              onChange={(e) => setFacetValue("category", e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </span>
        </Field>
        <Field label="Location" className="sm:w-52">
          <span className="flex gap-1">
            {modeToggle("location", "Location")}
            <Select
              fieldSize="sm"
              value={facetOf("location").value}
              onChange={(e) => setFacetValue("location", e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </span>
        </Field>
        <Field label="List" className="sm:w-44">
          <Select fieldSize="sm" value={params.get("list") ?? ""} onChange={(e) => setParam("list", e.target.value)}>
            <option value="">All lists</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Website" className="sm:w-36">
          <Select fieldSize="sm" value={params.get("web") ?? ""} onChange={(e) => setParam("web", e.target.value)}>
            <option value="">On or off</option>
            <option value="on">On website</option>
            <option value="off">Not on website</option>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show only">
        <ToggleChip
          pressed={flagged}
          onClick={() => toggleParam("flagged")}
          title={flagged ? "Show everything again" : "Show only the works you have flagged"}
        >
          {/* Warn is the flag's colour everywhere (row rule, flag bar);
              pressed, the chip's ink fill carries the state instead. */}
          <FlagIcon size={14} className={flagged ? undefined : "text-warn"} />
          Flagged
          {flaggedCount > 0 ? <span className="chip-count">{flaggedCount}</span> : null}
        </ToggleChip>
        {flags.map(({ param, label }) => (
          <ToggleChip key={param} pressed={Boolean(params.get(param))} onClick={() => toggleParam(param)}>
            {label}
          </ToggleChip>
        ))}
        <span
          aria-live="polite"
          className={`ml-1 text-[12px] text-meta transition-opacity ${pending ? "opacity-100" : "opacity-0"}`}
        >
          {pending ? "Updating…" : ""}
        </span>
      </div>
    </form>
  );
}
