"use client";

/*
 * The inventory overview's client state, shared between the header's tools
 * and the results below them (app/(app)/inventory/page.tsx).
 *
 *   <InventoryView flags>{page}</InventoryView>
 *     A context only (no element of its own). It holds:
 *       - whether the Filters panel is open (the header's Filters button
 *         and the panel under the header share it; it stays open while
 *         filters change, since a filter change is a soft navigation);
 *       - the table's view settings, density and the Website column, with
 *         their storage keys unchanged (jvb:inventory:density:v1,
 *         jvb:inventory:webcol:v1), so the View menu in the header can set
 *         what the table draws;
 *       - whether the column widths are customised, and how to reset them
 *         (the table owns the widths and reports them here);
 *       - one transition for every filter and search change: setParam and
 *         pushWith replace the URL (page reset to 1, every other parameter
 *         kept, the sort included), and `pending` is true until the new
 *         rows arrive, which the results dim for.
 *
 *   <ActiveFilters chips clearHref save?>
 *     The removable chips under the header. Each is a link to the current
 *     URL without that filter. A chip animates in when its filter appears
 *     and out when it goes, by its own × or by any other route (the panel,
 *     Clear all); the leaving chip stays mounted for the exit only.
 *     `save` is the "Save as live list" form, folded under a quiet toggle at
 *     the row's end.
 *
 *   <ViewMenu>  the header's View menu (from md, where the table shows).
 */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Collapse } from "@/components/ui/collapse";
import { Checkbox } from "@/components/ui/field";
import { ChevronDownIcon, CloseIcon, FlagIcon } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { MenuButton } from "@/components/ui/menu";
import { cx } from "@/components/ui/cx";

export const DENSITY_KEY = "jvb:inventory:density:v1";
export const WEB_COL_KEY = "jvb:inventory:webcol:v1";

/** The id of the Filters panel, which the header's Filters button controls. */
export const FILTERS_PANEL_ID = "inventory-filters";

export type Density = "comfortable" | "compact";

type ViewState = {
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  density: Density;
  toggleDensity: () => void;
  showWeb: boolean;
  toggleWebColumn: () => void;
  widthsCustomised: boolean;
  setWidthsCustomised: (customised: boolean) => void;
  /** Set by the table: puts every resizable column back to its default width. */
  resetWidths: React.RefObject<(() => void) | null>;
  /** The URL parameters that mean "a filter is on" (FLAG_FILTERS and the facets). */
  flagParams: string[];
  pending: boolean;
  pushWith: (mutate: (next: URLSearchParams) => void) => void;
  setParam: (key: string, value: string) => void;
};

const ViewContext = createContext<ViewState | null>(null);

export function useInventoryView(): ViewState {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useInventoryView needs <InventoryView> around it");
  return ctx;
}

/** The filter parameters the Filters panel sets (search excluded: it has its own field). */
const PANEL_PARAMS = ["ledger", "status", "category", "location", "list", "web", "flagged"] as const;

/** How many of the panel's filters are on, for the Filters button. */
export function countPanelFilters(params: URLSearchParams, flagParams: string[]): number {
  return [...PANEL_PARAMS, ...flagParams].filter((key) => Boolean(params.get(key))).length;
}

export function InventoryView({ flagParams, children }: { flagParams: string[]; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");
  const [showWeb, setShowWeb] = useState(false);
  const [widthsCustomised, setWidthsCustomised] = useState(false);
  const resetWidths = useRef<(() => void) | null>(null);

  // The persisted view settings, read after mount (no SSR mismatch).
  useEffect(() => {
    try {
      if (localStorage.getItem(DENSITY_KEY) === "compact") setDensity("compact");
      if (localStorage.getItem(WEB_COL_KEY) === "on") setShowWeb(true);
    } catch {
      /* storage blocked: the defaults stand */
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity((d) => {
      const next = d === "compact" ? "comfortable" : "compact";
      try {
        localStorage.setItem(DENSITY_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleWebColumn = useCallback(() => {
    setShowWeb((on) => {
      try {
        if (on) localStorage.removeItem(WEB_COL_KEY);
        else localStorage.setItem(WEB_COL_KEY, "on");
      } catch {
        /* ignore */
      }
      return !on;
    });
  }, []);

  const pushWith = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("page"); // any filter change returns to the first page
      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const setParam = useCallback(
    (key: string, value: string) =>
      pushWith((next) => {
        if (value) next.set(key, value);
        else next.delete(key);
      }),
    [pushWith],
  );

  const value = useMemo<ViewState>(
    () => ({
      filtersOpen,
      setFiltersOpen,
      density,
      toggleDensity,
      showWeb,
      toggleWebColumn,
      widthsCustomised,
      setWidthsCustomised,
      resetWidths,
      flagParams,
      pending,
      pushWith,
      setParam,
    }),
    [filtersOpen, density, toggleDensity, showWeb, toggleWebColumn, widthsCustomised, flagParams, pending, pushWith, setParam],
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

/**
 * The header's View menu: how the table is drawn. Only from md, where the
 * table shows (the phone list has no columns or density).
 */
export function ViewMenu() {
  const view = useInventoryView();
  return (
    <span className="hidden md:inline-block">
      <MenuButton label="View" panelClassName="w-64 p-3">
        <div className="flex flex-col gap-2.5">
          <Checkbox label="Compact rows" checked={view.density === "compact"} onChange={view.toggleDensity} />
          <Checkbox label="Website column" checked={view.showWeb} onChange={view.toggleWebColumn} />
          {view.widthsCustomised ? (
            <Button
              variant="quiet"
              size="sm"
              className="-ml-1.5 self-start"
              onClick={() => view.resetWidths.current?.()}
            >
              Reset column widths
            </Button>
          ) : null}
        </div>
        <p className="mt-3 border-t border-rule pt-2.5 text-[11.5px] leading-[1.9] text-meta">
          <span className="label mb-1">Keys</span>
          <Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>⏎</Kbd> open · <Kbd>x</Kbd> select · <Kbd>f</Kbd> flag ·{" "}
          <Kbd>/</Kbd> search
        </p>
      </MenuButton>
    </span>
  );
}

export type FilterChip = {
  /** The URL parameter the chip removes. */
  key: string;
  label: string;
  /** The current URL without this filter (and back to page 1). */
  href: string;
  /** The user's own flags: the chip carries the flag mark. */
  flag?: boolean;
};

type ShownChip = FilterChip & { leaving?: boolean };

/** How long a removed chip stays for its exit. Matches .inv-chip in app/globals.css. */
const CHIP_EXIT_MS = 200;

/**
 * Keeps removed chips on screen for their exit, at the place they were,
 * then lets them go. `removing` marks chips the user has just removed, so
 * their exit starts on the click rather than when the server answers.
 */
function usePresence(chips: FilterChip[], removing: Set<string>): ShownChip[] {
  const signature = chips.map((c) => `${c.key}\u0000${c.label}\u0000${c.href}`).join("\u0001");
  const [shown, setShown] = useState<ShownChip[]>(chips);
  const latest = useRef(chips);
  latest.current = chips;

  useEffect(() => {
    const now = latest.current;
    setShown((prev) => {
      const keep = new Set(now.map((c) => c.key));
      const out: ShownChip[] = [...now];
      prev.forEach((old, i) => {
        if (!keep.has(old.key)) out.splice(Math.min(i, out.length), 0, { ...old, leaving: true });
      });
      return out;
    });
    const timer = setTimeout(() => setShown(latest.current), CHIP_EXIT_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  return shown.map((c) => (removing.has(c.key) ? { ...c, leaving: true } : c));
}

export function ActiveFilters({
  chips,
  clearHref,
  save,
}: {
  chips: FilterChip[];
  clearHref: string;
  /** The "Save as live list" form, shown folded under its toggle. */
  save?: ReactNode;
}) {
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [saveOpen, setSaveOpen] = useState(false);
  const shown = usePresence(chips, removing);
  // A new set of chips from the server settles any removal in flight.
  const signature = chips.map((c) => c.key).join(",");
  useEffect(() => setRemoving(new Set()), [signature]);

  const live = shown.filter((c) => !c.leaving);
  if (shown.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2" role="group" aria-label="Active filters">
        {shown.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            data-leaving={chip.leaving || undefined}
            aria-hidden={chip.leaving || undefined}
            tabIndex={chip.leaving ? -1 : undefined}
            onClick={() => setRemoving((s) => new Set(s).add(chip.key))}
            className="chip inv-chip"
            aria-label={`Remove filter: ${chip.label}`}
            title="Remove this filter"
          >
            {chip.flag ? <FlagIcon size={14} className="fill-current text-warn" /> : null}
            <span className="truncate">{chip.label}</span>
            <CloseIcon size={14} className="inv-chip-x" />
          </Link>
        ))}
        {live.length > 0 ? (
          <ButtonLink
            href={clearHref}
            variant="quiet"
            size="sm"
            onClick={() => setRemoving(new Set(chips.map((c) => c.key)))}
          >
            Clear all
          </ButtonLink>
        ) : null}
        {save && live.length > 0 ? (
          <Button
            variant="quiet"
            size="sm"
            className="ml-auto"
            aria-expanded={saveOpen}
            aria-controls="inventory-save-list"
            onClick={() => setSaveOpen((o) => !o)}
          >
            Save as live list
            <ChevronDownIcon size={14} />
          </Button>
        ) : null}
      </div>
      {save ? (
        <Collapse id="inventory-save-list" open={saveOpen && live.length > 0}>
          <div className={cx("inv-fold mt-2")}>{save}</div>
        </Collapse>
      ) : null}
    </div>
  );
}
