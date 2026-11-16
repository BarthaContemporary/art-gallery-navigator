"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { highlightParts } from "@/lib/fold";
import { ratioUrl, type SanityImage } from "@/lib/sanity";
import { ARTISTS_UNDER_CONSTRUCTION } from "@/lib/site";
import { openWork, workOnThisPage } from "@/lib/work-open";

/**
 * Search — the only overlay on the site (handoff 2h). Opens from the header
 * icon or ⌘K / Ctrl-K, full screen on #faf9f6, logo top-left, ✕ top-right.
 * Instant results grouped under grey eyebrows; the matched substring in bold;
 * Esc closes; focus stays inside while open and returns to what opened it.
 * Choosing a result closes the overlay, also when the result is on the page
 * already shown.
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
  ...(ARTISTS_UNDER_CONSTRUCTION ? [] : [{ key: "artist", label: "Artists" }]),
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

/**
 * Bold every occurrence of the query terms inside a result line, folded the
 * same way as the search itself (lib/fold), so "hozan" bolds "Hōzan".
 */
function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.match ? (
          <b key={i} className="font-semibold text-ink">
            {p.text}
          </b>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

/** A plain click or Enter: not one that opens the link in a new tab or window. */
function plainActivation(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

type Results = { key: string; total: number; groups: Group[]; failed: boolean };

export function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  // The last answer, with the scope and query it belongs to: until the
  // answer for what is typed now arrives, the count reads "…" and the
  // previous results stay, rather than "Nothing found" while typing.
  const [results, setResults] = useState<Results | null>(null);
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

  // Esc, body scroll lock, focus trap, initial focus; on closing, focus goes
  // back to what opened the overlay (the header's Search button), if it is
  // still on the page.
  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
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
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open, close]);

  // Instant search, debounced.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setResults(null);
      return;
    }
    const key = `${scope}:${q}`;
    const controller = new AbortController();
    const run = async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scope}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`search answered ${res.status}`);
        const json = (await res.json()) as { total?: number; groups?: Group[] };
        setResults({ key, total: json.total ?? 0, groups: json.groups ?? [], failed: false });
      } catch {
        // Superseded by a newer query: that one will answer.
        if (controller.signal.aborted) return;
        // Offline or a failed answer: say so (keeping what was shown) rather than "…" for ever.
        setResults((prev) => ({ key, total: prev?.total ?? 0, groups: prev?.groups ?? [], failed: true }));
      }
    };
    const t = setTimeout(() => void run(), 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, scope, open]);

  if (!open) return null;

  const trimmed = query.trim();
  const settled = results !== null && results.key === `${scope}:${trimmed}`;
  const failed = settled && results.failed;
  const groups = results?.groups ?? [];
  const total = results?.total ?? 0;

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
            <span className="shrink-0 font-sans text-small text-meta" aria-live="polite">
              {!settled ? "…" : failed ? "Search unavailable" : `${total} result${total === 1 ? "" : "s"}`}
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
          ) : groups.length === 0 && failed ? (
            <p className="font-sans text-ui text-meta">Search is not available just now. Please try again in a moment.</p>
          ) : groups.length === 0 && settled ? (
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
                            // Close on choosing, not only when the path changes:
                            // a result on the page already shown (its event, or a
                            // work hanging in it) changes only the query string.
                            // A Cmd/Ctrl-click into a new tab leaves search open.
                            // A work on this page: when its grid takes it (opens
                            // the panel, scrolls it into view, writes ?work=), no
                            // navigation, or Next's scroll to the top after it
                            // would undo the centring.
                            onClick={(e) => {
                              if (!plainActivation(e)) return;
                              const work = workOnThisPage(h.href, window.location.href);
                              if (work && openWork(work)) e.preventDefault();
                              close();
                            }}
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
                              <span className="shrink-0 font-sans text-small text-meta">{h.meta}</span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {g.total > g.hits.length ? (
                    <p className="mt-2 font-sans text-small text-meta">
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
