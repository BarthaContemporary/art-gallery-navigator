"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = { href: string; label: string };

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
      <header className="sticky top-0 z-40 bg-[var(--jvb-bg-header)] backdrop-blur-md">
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

            {/* Desktop sign out */}
            <form action={signOut} className="ml-auto hidden shrink-0 md:block">
              <button
                type="submit"
                title={userEmail ?? undefined}
                className="rounded-lg border border-line-control bg-control px-3 py-1.5 text-[12px] font-medium text-ink-mid"
              >
                Sign out
              </button>
            </form>

            {/* Mobile trigger */}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              className="ml-auto text-[13px] font-medium text-ink-strong md:hidden"
            >
              {open ? "Close" : "Menu"}
            </button>
          </div>

          {/* Row 2 — desktop nav, wraps beneath the wordmark, flush-left with it */}
          <nav className="-ml-2.5 mt-2 hidden flex-wrap items-center justify-start gap-x-0.5 gap-y-1 md:flex">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`shrink-0 px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                  isActive(n.href)
                    ? "text-oranje"
                    : "text-ink-mid hover:text-ink-strong"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile full-screen overlay menu — sibling of <header> so its fixed
          positioning and backdrop-blur resolve against the viewport. */}
      {open ? (
        <div
          className="fixed inset-0 z-50 backdrop-blur-2xl backdrop-saturate-150 md:hidden"
          style={{ backgroundColor: "rgba(250, 250, 250, 0.5)" }}
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
