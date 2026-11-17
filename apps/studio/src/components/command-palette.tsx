"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { isComposing, isEditableTarget } from "@/lib/ui-events";
import { isSearchable } from "@/lib/opensearch/query";
import { failedText, GROUP_HEADINGS, isSimilar, paletteRows, type PaletteRow, type RowGroup } from "@/lib/palette-rows";
import type { PaletteResponse } from "@/lib/palette-search";

type NavItem = { href: string; label: string; group?: string };
type Row = PaletteRow;

/**
 * A button that opens the palette from inside a page (the not-found page),
 * through the same event the header's Search button sends.
 */
export function OpenSearchButton({ children = "Search" }: { children?: React.ReactNode }) {
  return (
    <Button
      icon={<SearchIcon size={16} />}
      onClick={() => window.dispatchEvent(new Event("jvb:command-palette"))}
    >
      {children}
    </Button>
  );
}

/**
 * Global ⌘K palette. Opens on ⌘K / Ctrl-K from anywhere, blends page
 * navigation with live search (/api/search: works, makers, contacts for
 * admin and staff, and records such as offers, documents and lists), with
 * rows through to the full inventory and contacts searches. Fully
 * keyboard-driven: ↑/↓ to move, ⏎ to go, Esc to close. A combobox over a
 * listbox whose groups are named by their headings: focus stays in the
 * field and aria-activedescendant names the highlighted row, so a screen
 * reader follows the arrows. Closing hands focus back to where it was.
 * The rows are built by lib/palette-rows.ts.
 */
export function CommandPalette({ navItems }: { navItems: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // The last search's answer (kept on screen while the next one runs).
  const [answer, setAnswer] = useState<PaletteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  // The search request failed (a lapsed session, a server error): said as
  // such, not as "No matches.", which reads as if nothing were there.
  const [searchFailed, setSearchFailed] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // The results scroll inside the palette; the keyboard row is kept in view.
  const listRef = useRef<HTMLDivElement>(null);
  // Set by the arrow keys, so only a keyboard move scrolls (a row half under
  // the pointer must not jump when the mouse highlights it).
  const keyboardMove = useRef(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Where focus was before the palette opened, to return it on close.
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();

  // Global open shortcut + a custom event the header search button dispatches
  // (so pointer-only users on mobile can open it too).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // "/" opens search too — but not while typing in a field (the address
      // finder's field is inside a web component: isEditableTarget).
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("jvb:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("jvb:command-palette", onOpen);
    };
  }, []);

  // Reset + focus on open; lock body scroll while open. Escape closes from
  // anywhere in the page, not only from the field.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQ("");
    setAnswer(null);
    setSearchFailed(false);
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      // Escape during a composition cancels the conversion, not the palette.
      if (isComposing(e)) return;
      if (e.key === "Escape") setOpen(false);
      // A modal dialog whose only control is the field: Tab stays in it
      // rather than moving to a link in the page behind the scrim.
      if (e.key === "Tab") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      // Back to the control that opened it (the header's Search button), unless
      // the palette navigated away and that control is gone.
      const back = returnFocus.current;
      if (back && back.isConnected) back.focus();
    };
  }, [open]);

  // Debounced remote search.
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    // Two characters, or one Han / kana / Hangul character (塩): the route's own rule.
    if (!isSearchable(query)) {
      setAnswer(null);
      setSearchFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    let cancelled = false;
    debounce.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((json: Partial<PaletteResponse>) => {
          if (cancelled) return;
          setAnswer({
            pieces: json.pieces ?? [],
            makers: json.makers ?? [],
            contacts: json.contacts ?? [],
            records: json.records ?? [],
            similar: { pieces: false, makers: false, contacts: false, ...json.similar },
            failed: json.failed ?? [],
          });
          setSearchFailed(false);
        })
        .catch(() => {
          if (!cancelled) {
            setAnswer(null);
            setSearchFailed(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
    };
  }, [q, open]);

  // Flatten everything into one ordered list for arrow navigation, then
  // group it again (consecutive rows of one kind) for the headings.
  const rows = useMemo<Row[]>(() => paletteRows(navItems, q, answer), [navItems, q, answer]);
  const sections = useMemo(() => {
    const out: { group: RowGroup; start: number; rows: Row[] }[] = [];
    rows.forEach((row, i) => {
      const last = out[out.length - 1];
      if (last && last.group === row.group) last.rows.push(row);
      else out.push({ group: row.group, start: i, rows: [row] });
    });
    return out;
  }, [rows]);
  // Some groups could not be searched: said beside the rest, never as "No matches.".
  const partlyFailed = answer ? failedText(answer.failed) : null;

  // Keep the active index in range as results change.
  useEffect(() => {
    setActive((a) => (a >= rows.length ? Math.max(0, rows.length - 1) : a));
  }, [rows.length]);

  // After an arrow key, bring the highlighted row into view inside the
  // scrolling list (Enter opens it, so it must be visible). The first row
  // scrolls the list to its top, so its group heading shows too.
  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    if (active === 0) {
      if (listRef.current) listRef.current.scrollTop = 0;
      return;
    }
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const go = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      setOpen(false);
      router.push(row.href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    // While an input method composes (typing 小林), Enter confirms the
    // conversion and the arrows move through its candidates: none of them
    // is the palette's.
    if (isComposing(e)) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      keyboardMove.current = true;
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      keyboardMove.current = true;
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(rows[active]);
    }
  };

  if (!open) return null;

  const optionId = (i: number) => `${listId}-${i}`;
  const searchable = isSearchable(q.trim());

  return (
    <div
      className="jvb-scrim-enter fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
      style={{ background: "var(--jvb-scrim)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* A floating layer over a scrim: the one place a shadow belongs (spec
          R5). data-inset-focus draws the field's ring inside the frame. */}
      <div
        data-inset-focus
        className="jvb-pop-enter w-full max-w-[560px] overflow-hidden border border-rule-strong bg-page shadow-[var(--jvb-shadow-pop)]"
      >
        {/* The icon sits inside the field's padding, so the inset focus ring
            frames the whole search row rather than hugging the typed text. */}
        <div className="relative border-b border-rule">
          <SearchIcon size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-meta" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              // New results start at the top, with row 0 highlighted in view.
              if (listRef.current) listRef.current.scrollTop = 0;
            }}
            onKeyDown={onKeyDown}
            placeholder="Search works, makers, contacts and records, or go to a page"
            aria-label="Search"
            role="combobox"
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={rows[active] ? optionId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            className="block h-12 w-full bg-transparent pl-11 pr-4 text-[14.5px] text-ink placeholder:text-meta"
          />
        </div>
        {/* tabIndex -1: Chrome and Firefox would otherwise make the scroller a tab stop. */}
        <div ref={listRef} tabIndex={-1} className="max-h-[52vh] overflow-y-auto py-1.5">
          {rows.length === 0 ? (
            <p role="status" className="px-4 py-6 text-center text-[13px] text-meta">
              {loading
                ? "Searching…"
                : searchable
                  ? searchFailed
                    ? "Couldn’t search. Try again in a moment, or reload the page."
                    : partlyFailed ?? "No matches."
                  : "Type to search, or pick a page."}
            </p>
          ) : (
            <div id={listId} role="listbox" aria-label="Results">
              {sections.map((section) => {
                const headingId = `${listId}-g${section.start}`;
                const similar = isSimilar(section.group, answer);
                return (
                  // One group per heading, named by it: a screen reader says
                  // "Works, similar matches" as the arrows enter it.
                  <div key={`${section.group}-${section.start}`} role="group" aria-labelledby={headingId}>
                    <p
                      id={headingId}
                      role="presentation"
                      className="px-4 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-meta"
                    >
                      {GROUP_HEADINGS[section.group]}
                      {similar ? (
                        <span className="font-normal normal-case tracking-normal">
                          <span aria-hidden> · </span>
                          <span className="sr-only">, </span>
                          Similar matches
                        </span>
                      ) : null}
                    </p>
                    {section.rows.map((row, j) => {
                      const i = section.start + j;
                      const current = i === active;
                      return (
                        // The highlighted row is the keyboard row of a table:
                        // band with a 2px accent rule.
                        <div
                          key={row.key}
                          id={optionId(i)}
                          role="option"
                          aria-selected={current}
                          onMouseMove={() => {
                            if (current) return;
                            keyboardMove.current = false;
                            setActive(i);
                          }}
                          onClick={() => go(row)}
                          className={cx(
                            "relative flex cursor-pointer items-center justify-between gap-3 px-4 py-2",
                            current && "bg-band before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent before:content-['']",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13.5px] text-ink">{row.label}</span>
                            {row.sub ? (
                              <span className={cx("block truncate text-[12px]", current ? "text-body" : "text-meta")}>
                                {row.sub}
                              </span>
                            ) : null}
                            {row.note ? (
                              <span className={cx("block truncate text-[11.5px] italic", current ? "text-body" : "text-meta")}>
                                {row.note}
                              </span>
                            ) : null}
                          </span>
                          {current ? (
                            <kbd aria-hidden className="shrink-0 font-sans text-[11px] text-body">
                              ⏎
                            </kbd>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
          {rows.length > 0 && !loading && (searchFailed || partlyFailed) ? (
            <p role="status" className="px-4 pb-1.5 pt-2.5 text-[12px] leading-[1.4] text-meta">
              {searchFailed ? "Couldn’t search; only pages are listed." : partlyFailed}
            </p>
          ) : null}
        </div>
        <div
          aria-hidden
          className="flex items-center gap-4 border-t border-rule px-4 py-2 text-[11px] leading-[1.3] text-meta"
        >
          <span>
            <kbd className="font-sans">↑↓</kbd> move
          </span>
          <span>
            <kbd className="font-sans">⏎</kbd> open
          </span>
          <span>
            <kbd className="font-sans">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
