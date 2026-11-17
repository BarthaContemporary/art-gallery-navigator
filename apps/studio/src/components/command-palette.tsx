"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { SearchIcon } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { isComposing, isEditableTarget } from "@/lib/ui-events";

type NavItem = { href: string; label: string; group?: string };
type Piece = {
  id: string;
  stock_number: string;
  title: string | null;
  maker_name: string | null;
  status: string | null;
};
type Contact = { id: string; name: string; email: string | null };

type Row =
  | { kind: "page"; href: string; label: string; sub?: string }
  | { kind: "piece"; href: string; label: string; sub?: string }
  | { kind: "contact"; href: string; label: string; sub?: string };

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
 * navigation with live piece + contact search (via /api/search, which reuses
 * the pieces_search + crm_contacts_search RPCs). Fully keyboard-driven:
 * ↑/↓ to move, ⏎ to go, Esc to close. A combobox over a listbox: focus stays
 * in the field and aria-activedescendant names the highlighted row, so a
 * screen reader follows the arrows. Closing hands focus back to where it was.
 */
export function CommandPalette({ navItems }: { navItems: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
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
    setPieces([]);
    setContacts([]);
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
    if (query.length < 2) {
      setPieces([]);
      setContacts([]);
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
        .then((json: { pieces?: Piece[]; contacts?: Contact[] }) => {
          if (cancelled) return;
          setPieces(json.pieces ?? []);
          setContacts(json.contacts ?? []);
          setSearchFailed(false);
        })
        .catch(() => {
          if (!cancelled) {
            setPieces([]);
            setContacts([]);
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

  // Flatten everything into one ordered list for arrow navigation.
  const rows = useMemo<Row[]>(() => {
    const query = q.trim().toLowerCase();
    const pages = navItems
      .filter((n) => !query || n.label.toLowerCase().includes(query))
      .map<Row>((n) => ({ kind: "page", href: n.href, label: n.label, sub: "Go to" }));
    const pieceRows = pieces.map<Row>((p) => ({
      kind: "piece",
      href: `/inventory/${encodeURIComponent(p.stock_number)}`,
      label: p.title?.trim() ? p.title : p.stock_number,
      sub: [p.stock_number, p.maker_name, p.status ? STATUS_LABELS[p.status] ?? p.status : null]
        .filter(Boolean)
        .join(" · "),
    }));
    const contactRows = contacts.map<Row>((c) => ({
      kind: "contact",
      href: `/crm/contacts/${c.id}`,
      label: c.name,
      sub: c.email ?? "Contact",
    }));
    return [...pages, ...pieceRows, ...contactRows];
  }, [navItems, pieces, contacts, q]);

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

  // Section headers derived from the flat list, so we can still render groups.
  let lastKind: Row["kind"] | null = null;
  const heading: Record<Row["kind"], string> = {
    page: "Pages",
    piece: "Inventory",
    contact: "Contacts",
  };

  const optionId = (i: number) => `${listId}-${i}`;

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
            placeholder="Search works and contacts, or go to a page"
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
                : q.trim().length >= 2
                  ? searchFailed
                    ? "Couldn't search works and contacts. Try again in a moment, or reload the page."
                    : "No matches."
                  : "Type to search, or pick a page."}
            </p>
          ) : (
            <div id={listId} role="listbox" aria-label="Results">
              {rows.map((row, i) => {
                const showHeading = row.kind !== lastKind;
                lastKind = row.kind;
                const current = i === active;
                return (
                  <div key={`${row.kind}-${row.href}-${i}`} role="presentation">
                    {showHeading ? (
                      <p
                        role="presentation"
                        className="px-4 pb-1 pt-2.5 text-[11.5px] font-semibold uppercase leading-[1.3] tracking-[0.06em] text-meta"
                      >
                        {heading[row.kind]}
                      </p>
                    ) : null}
                    {/* The highlighted row is the keyboard row of a table:
                        band with a 2px accent rule. */}
                    <div
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
                      </span>
                      {current ? (
                        <kbd aria-hidden className="shrink-0 font-sans text-[11px] text-body">
                          ⏎
                        </kbd>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {rows.length > 0 && searchFailed && !loading ? (
            <p role="status" className="px-4 pb-1.5 pt-2.5 text-[12px] leading-[1.4] text-meta">
              Couldn&rsquo;t search works and contacts; only pages are listed.
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
