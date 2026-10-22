"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { CloseIcon, SearchIcon } from "@/components/ui/icons";
import { Kbd } from "@/components/ui/kbd";
import { MoonGateMark } from "@/components/ui/moon-gate";
import { cx } from "@/components/ui/cx";

type NavItem = { href: string; label: string; group?: string };

const openPalette = () => window.dispatchEvent(new Event("jvb:command-palette"));

/**
 * Back-office header, in the public site's family (spec C1): the Moon Gate
 * mark (the gallery's icon; its seal pulses once on hover) beside the
 * wordmark in the accent, the nav in meta with ink for the current page and
 * a square 2px accent rule under it. The search trigger is drawn as a field
 * (white in the field frame), since what it opens is a search box. On top of the website's header it is sticky (the
 * page at 92% under a blur), and it carries search, the theme and sign-out.
 * Below md the wordmark stacks ("Joost / van den Bergh") and the nav moves
 * into a full-screen menu behind "Menu", which closes on any link tap and on
 * Escape and holds the theme and account controls in its footer.
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
  // The item the user just chose: drawn as the current page while the next
  // one loads, so the click registers before the route (and aria-current)
  // catches up.
  const [pending, setPending] = useState<string | null>(null);
  // The palette shortcut as this keyboard writes it. Null until mounted, so
  // the server render and the first client render agree.
  const [shortcut, setShortcut] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setPending(null);
  }, [pathname]);

  useEffect(() => {
    const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    setShortcut(mac ? "⌘K" : "Ctrl K");
  }, []);

  // While the menu is open: no page scroll behind it, focus inside it and
  // kept there (it is a modal layer: Tab and Shift+Tab cycle through its
  // controls and never reach the page behind), and Escape closes it and
  // hands focus back to the Menu button.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(
        overlayRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        const inside = Boolean(active && overlayRef.current?.contains(active));
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault();
          first.focus();
        }
        return;
      }
      if (e.key !== "Escape") return;
      e.preventDefault();
      setOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
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
  // What is drawn as current: the pending choice while a page loads,
  // otherwise the active page. aria-current stays with the real page.
  const isShownCurrent = (href: string) => (pending ? href === pending : isActive(href));

  const choose = (href: string) => {
    setPending(href === activeHref ? null : href);
    setOpen(false);
  };

  const wordmarkStacked = (
    <>
      Joost
      <br />
      van den Bergh
    </>
  );

  return (
    <>
      <header ref={headerRef} className="sticky top-0 z-40 bg-[var(--jvb-header-bg)] backdrop-blur-md">
        <a
          href="#main"
          className="sr-only z-50 bg-page px-3 py-2 text-[13px] font-medium text-ink focus:not-sr-only focus:absolute focus:left-[var(--jvb-pad)] focus:top-2"
        >
          Skip to content
        </a>
        <div className="page pb-1 pt-3 md:pb-0">
          {/* Row 1: wordmark, then search, theme and account */}
          <div className="flex items-center gap-4">
            {/* The wordmark is the brand in the accent, as on the website (a
                logo is exempt from the text-contrast rule). */}
            <Link
              href="/"
              className="mg-hover flex shrink-0 items-center gap-2.5 text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-accent transition-[color] hover:text-accent-deep"
            >
              <MoonGateMark pulse="hover" className="h-7 w-7 text-ink md:h-5 md:w-5" />
              <span className="hidden whitespace-nowrap md:inline">Joost van den Bergh</span>
              <span className="md:hidden">{wordmarkStacked}</span>
            </Link>

            {/* Desktop actions */}
            <div className="ml-auto hidden shrink-0 items-center gap-1.5 md:flex">
              <button
                type="button"
                onClick={openPalette}
                aria-label="Search"
                aria-keyshortcuts="Meta+K Control+K /"
                className="field field-sm flex w-[180px] cursor-pointer items-center gap-2 text-left text-meta"
              >
                <SearchIcon size={14} />
                <span>Search</span>
                {shortcut ? (
                  <Kbd boxed={false} className="ml-auto text-meta">
                    {shortcut}
                  </Kbd>
                ) : null}
              </button>
              <ThemeToggle />
              <form action={signOut}>
                <Button type="submit" variant="quiet" size="sm" title={userEmail ?? undefined} pendingLabel="Signing out…">
                  Sign out
                </Button>
              </form>
            </div>

            {/* Phone and small tablet: search and the menu, 44px targets */}
            <div className="-mr-2 ml-auto flex items-center md:hidden">
              {/* Quiet buttons held at 44px on any phone-width screen: the
                  search glass grows on hover, "Menu" draws its underline. */}
              <Button variant="quiet" iconOnly label="Search" onClick={openPalette} className="h-11 w-11 text-ink">
                <SearchIcon size={20} />
              </Button>
              <Button
                ref={menuButtonRef}
                variant="quiet"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-controls="app-menu"
                aria-label={open ? "Close menu" : "Open menu"}
                className="h-11 min-w-11 px-2 text-ink"
              >
                {open ? "Close" : "Menu"}
              </Button>
            </div>
          </div>

          {/* Row 2: desktop nav, wraps beneath the wordmark, flush-left with it.
              Slightly tighter below xl, so the whole nav keeps to one row on
              an iPad in landscape (1024). */}
          <nav aria-label="Main" className="-ml-2 mt-1.5 hidden flex-wrap items-center md:flex xl:-ml-2.5 xl:gap-x-0.5">
            {items.map((n, i) => {
              const shown = isShownCurrent(n.href);
              const newGroup = i > 0 && n.group !== items[i - 1]?.group;
              return (
                <span key={n.href} className="flex shrink-0 items-center">
                  {newGroup ? <span aria-hidden className="mx-1 h-3.5 w-px bg-rule-strong xl:mx-1.5" /> : null}
                  <Link
                    href={n.href}
                    onClick={() => choose(n.href)}
                    aria-current={isActive(n.href) ? "page" : undefined}
                    className={cx(
                      "relative inline-flex h-9 shrink-0 items-center px-2 text-[13px] font-medium transition-[color] xl:px-2.5",
                      // The current page: ink, with a square accent rule along
                      // the header's bottom edge.
                      shown
                        ? "text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-accent after:content-[''] xl:after:inset-x-2.5"
                        : "text-meta hover:text-ink",
                    )}
                  >
                    {n.label}
                  </Link>
                </span>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Phone menu: a full-screen layer, sibling of <header> so its fixed
          positioning and backdrop-blur resolve against the viewport. */}
      {open ? (
        <div
          ref={overlayRef}
          id="app-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto md:hidden"
          style={{
            backgroundColor: "var(--jvb-bg-overlay)",
            backdropFilter: "blur(22px) saturate(1.4)",
            WebkitBackdropFilter: "blur(22px) saturate(1.4)",
          }}
        >
          <div className="page flex items-start justify-between pt-3">
            <span className="flex items-center gap-2.5 text-[15px] font-bold leading-[1.05] tracking-[-0.01em] text-accent">
              <MoonGateMark className="h-7 w-7 text-ink" />
              <span>{wordmarkStacked}</span>
            </span>
            <Button
              variant="quiet"
              icon={<CloseIcon size={16} />}
              onClick={() => {
                setOpen(false);
                menuButtonRef.current?.focus();
              }}
              aria-label="Close menu"
              className="-mr-2 -mt-1 h-11 px-2 text-ink"
            >
              Close
            </Button>
          </div>
          <nav aria-label="Main" className="page mt-8 flex flex-col">
            {items.map((n, i) => {
              const shown = isShownCurrent(n.href);
              const newGroup = i > 0 && n.group !== items[i - 1]?.group;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => choose(n.href)}
                  aria-current={isActive(n.href) ? "page" : undefined}
                  className={cx(
                    "flex min-h-11 items-center border-l-2 pl-3 text-[18px] font-medium tracking-[-0.01em] transition-[color]",
                    newGroup && "mt-3",
                    shown ? "border-accent text-ink" : "border-transparent text-meta active:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          {/* Theme and account, which the phone header has no room for. */}
          <div className="page mt-auto border-t border-rule-strong pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
            {userEmail ? (
              <p className="mb-3 truncate text-[12px] leading-[1.4] text-meta">Signed in as {userEmail}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle withLabel />
              <form action={signOut}>
                <Button type="submit" pendingLabel="Signing out…">
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
