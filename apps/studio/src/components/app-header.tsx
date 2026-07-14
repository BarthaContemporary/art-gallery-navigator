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

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const wordmarkStacked = (
    <>
      Joost
      <br />
      van den Bergh
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-[var(--jvb-bg-header)] backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-4 py-3 md:px-8">
          <Link
            href="/"
            className="shrink-0 text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-ink-strong"
          >
            <span className="hidden whitespace-nowrap md:inline">
              Joost van den Bergh
            </span>
            <span className="md:hidden">{wordmarkStacked}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium hover:bg-control-active ${
                  isActive(n.href)
                    ? "bg-control-active text-ink-strong"
                    : "text-ink-mid"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

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
      </header>

      {/* Mobile full-screen overlay menu — sibling of <header> so its fixed
          positioning and backdrop-blur resolve against the viewport. */}
      {open ? (
        <div className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--jvb-bg-page)_85%,transparent)] backdrop-blur-xl md:hidden">
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
          <nav className="mt-10 flex flex-col gap-5 px-4">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`text-[26px] font-semibold tracking-[-0.01em] ${
                  isActive(n.href) ? "text-ink-strong" : "text-ink-mid"
                }`}
              >
                {n.label}
              </Link>
            ))}
            <form action={signOut} className="mt-6">
              <button
                type="submit"
                className="text-[15px] font-medium text-ink-soft"
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
