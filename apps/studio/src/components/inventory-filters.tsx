"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { STATUS_LABELS } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { ExpandingSearch } from "@/components/ui/expanding-search";
import { Field, Select } from "@/components/ui/field";
import { ToggleChip } from "@/components/ui/chips";
import { ChevronDownIcon, FilterIcon, FlagIcon } from "@/components/ui/icons";
import { MoonGateLoader } from "@/components/ui/moon-gate";
import { FILTERS_PANEL_ID, countPanelFilters, useInventoryView } from "@/components/inventory-view";

type Option = { id: string; name: string };

/*
 * The inventory's search and filters. Everything applies the moment it
 * changes (no Apply button: the list reacts as you go); the search applies
 * on a short debounce, or at once on Enter. Every change goes through the
 * shared view context (components/inventory-view), which returns to page 1
 * and keeps every other parameter, the sort included. The parameters and
 * their encodings are unchanged: a facet holds "value" (include) or
 * "!value" (exclude); a boolean filter is "1" or absent.
 *
 *   <InventorySearch>   the header's search: an ExpandingSearch, open while
 *                       a query is set, "/" opens it.
 *   <FiltersToggle>     the header's Filters button, with how many filters
 *                       are on; opens and closes the panel below.
 *   <InventoryFilters>  the folding panel: register, status, category,
 *                       location, list and website, then the "show only"
 *                       switches (the user's flags and FLAG_FILTERS, passed
 *                       in so this client bundle does not pull the query
 *                       helpers).
 */

export function InventorySearch() {
  const view = useInventoryView();
  const params = useSearchParams();
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

  function push(value: string) {
    lastPushed.current = value;
    view.setParam("q", value);
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => push(value.trim()), 350);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounce.current) clearTimeout(debounce.current);
    push(q.trim());
  }

  return (
    <form onSubmit={onSearchSubmit} role="search" aria-label="Search inventory" className="inv-search">
      <ExpandingSearch
        name="q"
        label="Search inventory"
        value={q}
        onValueChange={onSearchChange}
        placeholder="Stock no., title, maker…"
        width="18rem"
        shortcut
      />
    </form>
  );
}

export function FiltersToggle() {
  const view = useInventoryView();
  const params = useSearchParams();
  const count = countPanelFilters(params, view.flagParams);
  return (
    <Button
      aria-expanded={view.filtersOpen}
      aria-controls={FILTERS_PANEL_ID}
      aria-label={count > 0 ? `Filters, ${count} on` : "Filters"}
      onClick={() => view.setFiltersOpen(!view.filtersOpen)}
      className="inv-filters-toggle"
      data-active={count > 0 || undefined}
    >
      <FilterIcon size={14} />
      Filters
      {/* Keyed on the count, so each change stamps the new figure in. */}
      {count > 0 ? (
        <span key={count} className="inv-count tabular">
          {count}
        </span>
      ) : null}
      <ChevronDownIcon size={14} />
    </Button>
  );
}

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
  const view = useInventoryView();
  const params = useSearchParams();
  const { setParam, pending } = view;

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
    return raw.startsWith("!") ? { value: raw.slice(1), exclude: true } : { value: raw, exclude: false };
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
        className="field-mode w-10 shrink-0 justify-center px-0"
      >
        {exclude ? "not" : "is"}
      </ToggleChip>
    );
  };

  const flagged = Boolean(params.get("flagged"));

  return (
    <Collapse id={FILTERS_PANEL_ID} open={view.filtersOpen}>
      <div className="pb-5">
        <div className="inv-fold inv-filters" role="group" aria-label="Filters">
          <div className="inv-filters-grid">
            <Field label="Register">
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
            <Field label="Status">
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
            <Field label="Category">
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
            <Field label="Location">
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
            <Field label="List">
              <Select fieldSize="sm" value={params.get("list") ?? ""} onChange={(e) => setParam("list", e.target.value)}>
                <option value="">All lists</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Website">
              <Select fieldSize="sm" value={params.get("web") ?? ""} onChange={(e) => setParam("web", e.target.value)}>
                <option value="">On or off</option>
                <option value="on">On website</option>
                <option value="off">Not on website</option>
              </Select>
            </Field>
          </div>

          <div className="inv-filters-foot">
            <span className="label" id="inventory-show-only">
              Show only
            </span>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-labelledby="inventory-show-only">
              <ToggleChip
                pressed={flagged}
                onClick={() => toggleParam("flagged")}
                title={flagged ? "Show everything again" : "Show only the works you have flagged"}
              >
                {/* Warn is the flag's colour everywhere (row rule, flag line);
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
            </div>
            <span className="inv-filters-end">
              <span aria-live="polite" className="inv-updating" data-on={pending || undefined}>
                {pending ? (
                  <>
                    <MoonGateLoader size={12} />
                    Updating…
                  </>
                ) : null}
              </span>
              <Button variant="quiet" size="sm" onClick={() => view.setFiltersOpen(false)}>
                Done
              </Button>
            </span>
          </div>
        </div>
      </div>
    </Collapse>
  );
}
