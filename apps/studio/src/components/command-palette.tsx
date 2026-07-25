"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STATUS_LABELS } from "@/components/status-pill";

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
 * Global ⌘K palette. Opens on ⌘K / Ctrl-K from anywhere, blends page
 * navigation with live piece + contact search (via /api/search, which reuses
 * the pieces_search + crm_contacts_search RPCs). Fully keyboard-driven:
 * ↑/↓ to move, ⏎ to go, Esc to close.
 */
export function CommandPalette({ navItems }: { navItems: NavItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global open shortcut + a custom event the header search button dispatches
  // (so pointer-only users on mobile can open it too).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      // "/" opens search too — but not while typing in a field.
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = e.target as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
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

  // Reset + focus on open; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    setQ("");
    setPieces([]);
    setContacts([]);
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced remote search.
  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setPieces([]);
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounce.current) clearTimeout(debounce.current);
    let cancelled = false;
    debounce.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => (r.ok ? r.json() : { pieces: [], contacts: [] }))
        .then((json: { pieces?: Piece[]; contacts?: Contact[] }) => {
          if (cancelled) return;
          setPieces(json.pieces ?? []);
          setContacts(json.contacts ?? []);
        })
        .catch(() => {
          if (!cancelled) {
            setPieces([]);
            setContacts([]);
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

  const go = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      setOpen(false);
      router.push(row.href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
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

  return (
    <div
      className="jvb-scrim-enter fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
      style={{ background: "var(--jvb-bg-overlay)", backdropFilter: "blur(2px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="jvb-pop-enter w-full max-w-lg overflow-hidden rounded-[14px] border border-line bg-cell shadow-2xl">
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search inventory, contacts, or jump to a page…"
          aria-label="Search"
          className="w-full border-b border-line-soft bg-transparent px-4 py-3.5 text-[14px] text-ink-body outline-none placeholder:text-ink-faint"
        />
        <div className="max-h-[52vh] overflow-y-auto py-1.5">
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">
              {loading
                ? "Searching…"
                : q.trim().length >= 2
                  ? "No matches."
                  : "Type to search, or pick a page."}
            </p>
          ) : (
            rows.map((row, i) => {
              const showHeading = row.kind !== lastKind;
              lastKind = row.kind;
              return (
                <div key={`${row.kind}-${row.href}-${i}`}>
                  {showHeading ? (
                    <p className="px-4 pb-1 pt-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-faint">
                      {heading[row.kind]}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(row)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left ${
                      i === active ? "bg-oranje/10" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-ink-body">{row.label}</span>
                      {row.sub ? (
                        <span className="block truncate text-[11.5px] text-ink-muted">{row.sub}</span>
                      ) : null}
                    </span>
                    {i === active ? (
                      <span aria-hidden className="shrink-0 text-[11px] text-ink-faint">
                        ⏎
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line-soft px-4 py-2 text-[10.5px] text-ink-faint">
          <span>↑↓ move</span>
          <span>⏎ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
