"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = { href: string; label: string; group?: string };

/**
 * Back-office header. Mirrors the public site's navigation architecture:
 * a one-line wordmark with inline nav on desktop; below md the wordmark
 * stacks ("Joost / van den Bergh") and the nav collapses to a full-screen
 * overlay menu (page ground @ 85% + backdrop-blur) triggered by "Menu".
 */
export function AppHeader({
  items,
  userEmail,
  signOut,
}: {
  items: readonly NavItem[];
  userEmail: string | null;
  signOut: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The item the user just tapped — shown orange as press feedback while the
  // next page loads, so the tap registers before the overlay closes.
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setOpen(false);
    setPending(null);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Publish the sticky header's real height as a CSS var so sticky elements
  // below it (e.g. the inventory table's thead) can offset correctly — the
  // header height changes as the nav wraps, so measure rather than guess.
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty("--app-header-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A nav item matches when the path is it or sits under it. When several match
  // (e.g. "/inventory" and "/inventory/lists" both match /inventory/lists), only
  // the most specific — longest href — is treated as active.
  const matches = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
  const activeHref = items
    .map((n) => n.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  const wordmarkStacked = (
    <>
      Joost
      <br />
      van den Bergh
    </>
  );

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-40 bg-[var(--jvb-bg-header)] backdrop-blur-md">
        <div className="mx-auto max-w-[1320px] px-4 py-3 md:px-8">
          {/* Row 1 — wordmark + account/menu */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="shrink-0 text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-ink-strong"
            >
              <span className="hidden whitespace-nowrap md:inline">
                Joost van den Bergh
              </span>
              <span className="md:hidden">{wordmarkStacked}</span>
            </Link>

            {/* Desktop actions */}
            <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("jvb:command-palette"))}
                aria-label="Search (⌘K)"
                className="flex items-center gap-2 rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-muted hover:text-ink-strong"
              >
                <span>Search</span>
                <kbd className="rounded border border-line-control bg-band px-1.5 py-px font-mono text-[10.5px] text-ink-faint">
                  ⌘K
                </kbd>
              </button>
              <ThemeToggle />
              <form action={signOut}>
                <button
                  type="submit"
                  title={userEmail ?? undefined}
                  className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid"
                >
                  Sign out
                </button>
              </form>
            </div>

            {/* Mobile triggers */}
            <div className="ml-auto flex items-center gap-4 md:hidden">
              {!open ? (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("jvb:command-palette"))}
                  aria-label="Search"
                  className="grid h-11 w-11 -mr-2 place-items-center text-ink-strong"
                >
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-label={open ? "Close menu" : "Open menu"}
                className="text-[13px] font-medium text-ink-strong"
              >
                {open ? "Close" : "Menu"}
              </button>
            </div>
          </div>

          {/* Row 2 — desktop nav, wraps beneath the wordmark, flush-left with it */}
          <nav className="-ml-2.5 mt-2 hidden flex-wrap items-center justify-start gap-x-0.5 gap-y-1 md:flex">
            {items.map((n, i) => {
              const active = isActive(n.href);
              const newGroup = i > 0 && n.group !== items[i - 1]?.group;
              return (
                <span key={n.href} className="flex shrink-0 items-center">
                  {newGroup ? <span aria-hidden className="mx-1.5 h-3.5 w-px bg-line" /> : null}
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative shrink-0 px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                      active
                        ? "text-oranje after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-oranje after:content-['']"
                        : "text-ink-mid hover:text-ink-strong"
                    }`}
                  >
                    {n.label}
                  </Link>
                </span>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile full-screen overlay menu — sibling of <header> so its fixed
          positioning and backdrop-blur resolve against the viewport. */}
      {open ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{
            // Theme-aware overlay — was hardcoded light, which frosted the menu
            // as a light panel over the dark app in dark mode.
            backgroundColor: "var(--jvb-bg-overlay)",
            backdropFilter: "blur(22px) saturate(1.4)",
            WebkitBackdropFilter: "blur(22px) saturate(1.4)",
          }}
        >
          <div className="flex items-start justify-between px-4 py-3">
            <span className="text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-ink-strong">
              {wordmarkStacked}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="text-[13px] font-medium text-ink-strong"
            >
              Close
            </button>
          </div>
          <nav className="mt-9 flex flex-col gap-3.5 px-4">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setPending(n.href)}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`text-[18px] font-semibold tracking-[-0.01em] transition-colors duration-150 active:text-oranje ${
                  isActive(n.href) || pending === n.href ? "text-oranje" : "text-ink-mid"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <form action={signOut} className="mt-5">
              <button
                type="submit"
                className="text-[14px] font-medium text-ink-soft"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      ) : null}
    </>
  );
}
