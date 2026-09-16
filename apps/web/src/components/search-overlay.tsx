"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ratioUrl, type SanityImage } from "@/lib/sanity";

/**
 * Search — the only overlay on the site (handoff 2h). Opens from the header
 * icon or ⌘K / Ctrl-K, full screen on #faf9f6, logo top-left, ✕ top-right.
 * Instant results grouped under grey eyebrows; the matched substring in bold;
 * Esc closes; focus stays inside while open.
 */

const OPEN_EVENT = "jvb:search-open";

export function openSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

type Hit = {
  kind: "artist" | "event" | "work" | "publication";
  id: string;
  text: string;
  meta: string | null;
  href: string;
  image: SanityImage | null;
  ratio: number;
};
type Group = { kind: Hit["kind"]; total: number; hits: Hit[] };

const SCOPES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "artist", label: "Artists" },
  { key: "event", label: "Events" },
  { key: "work", label: "Works" },
  { key: "publication", label: "Publications" },
];
const GROUP_LABEL: Record<Hit["kind"], string> = {
  artist: "Artists",
  work: "Works",
  publication: "Publications",
  event: "Events",
};

/** Bold every occurrence of the query terms inside a result line. */
function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return <>{text}</>;
  const lower = text.toLowerCase();
  const marks: [number, number][] = [];
  for (const t of terms) {
    let i = lower.indexOf(t);
    while (i !== -1) {
      marks.push([i, i + t.length]);
      i = lower.indexOf(t, i + t.length);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let pos = 0;
  for (const [s, e] of marks) {
    if (s < pos) continue;
    if (s > pos) out.push(text.slice(pos, s));
    out.push(
      <b key={s} className="font-semibold text-ink">
        {text.slice(s, e)}
      </b>,
    );
    pos = e;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const close = useCallback(() => setOpen(false), []);

  // Open from the header icon / keyboard shortcut.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc, body scroll lock, focus trap, initial focus.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Instant search, debounced.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setGroups([]);
      setTotal(0);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scope}`, {
          signal: controller.signal,
        });
        const json = (await res.json()) as { total: number; groups: Group[] };
        setGroups(json.groups ?? []);
        setTotal(json.total ?? 0);
      } catch {
        /* aborted or offline — keep previous results */
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, scope, open]);

  if (!open) return null;

  const trimmed = query.trim();

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 overflow-y-auto bg-overlay"
    >
      <div className="page pt-6 pb-16 md:pt-7">
        <div className="flex items-baseline justify-between">
          <span className="font-sans text-[19px] font-bold leading-none text-accent md:text-[20px]">
            Joost van den Bergh
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="-mr-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center font-sans text-[22px] leading-none text-ink hover:text-accent"
          >
            ✕
          </button>
        </div>

        <div className="mt-10 flex items-baseline justify-between gap-6">
          <label htmlFor="site-search" className="sr-only">
            Search
          </label>
          <input
            id="site-search"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            autoComplete="off"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent font-sans text-[26px] font-light leading-tight text-ink caret-accent placeholder:text-light focus:outline-none md:text-[34px]"
          />
          {trimmed ? (
            <span className="shrink-0 font-sans text-meta text-meta" aria-live="polite">
              {loading ? "…" : `${total} result${total === 1 ? "" : "s"}`}
            </span>
          ) : null}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 font-sans text-ui">
          {SCOPES.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => setScope(s.key)}
                aria-pressed={scope === s.key}
                className={`min-h-[44px] ${scope === s.key ? "text-ink" : "text-meta hover:text-ink"}`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {!trimmed ? (
            <p className="font-sans text-ui text-meta">Try Gutai, Mingei, Tantra</p>
          ) : groups.length === 0 && !loading ? (
            <p className="font-sans text-ui text-meta">Nothing found for “{trimmed}”.</p>
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map((g) => (
                <section key={g.kind}>
                  <h2 className="label">{GROUP_LABEL[g.kind]}</h2>
                  <ul className="mt-3 flex flex-col">
                    {g.hits.map((h) => {
                      const w = 96;
                      const src = ratioUrl(h.image, h.ratio, w);
                      return (
                        <li key={h.id}>
                          <Link
                            href={h.href}
                            className="flex min-h-[56px] items-center gap-4 py-2 hover:text-accent"
                          >
                            <span
                              className="block shrink-0 overflow-hidden bg-field"
                              style={{ width: 40, aspectRatio: String(h.ratio) }}
                            >
                              {src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : null}
                            </span>
                            <span className="min-w-0 flex-1 font-sans text-body text-body">
                              <Highlight text={h.text} query={trimmed} />
                            </span>
                            {h.meta ? (
                              <span className="shrink-0 font-sans text-meta text-meta">{h.meta}</span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {g.total > g.hits.length ? (
                    <p className="mt-2 font-sans text-meta text-meta">
                      and {g.total - g.hits.length} more — narrow the search
                    </p>
                  ) : null}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
