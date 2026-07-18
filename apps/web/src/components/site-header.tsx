"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navLinks } from "@/lib/site";

export function SiteHeader({ galleryName }: { galleryName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The just-tapped item, shown orange as press feedback until the page loads.
  const [pending, setPending] = useState<string | null>(null);

  // Close the overlay on navigation.
  useEffect(() => {
    setOpen(false);
    setPending(null);
  }, [pathname]);

  // Lock body scroll while the overlay is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Wordmark stacks as "Joost / van den Bergh" below md; one line on desktop.
  const [firstWord, ...restWords] = galleryName.split(" ");
  const rest = restWords.join(" ");
  const stacked = rest ? (
    <>
      {firstWord}
      <br />
      {rest}
    </>
  ) : (
    galleryName
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-[color-mix(in_srgb,var(--washi)_92%,transparent)] backdrop-blur">
        <div className="page flex items-baseline justify-between gap-6 py-5">
        <Link
          href="/"
          className="font-sans text-ui font-medium tracking-tight text-sumi"
        >
          <span className="hidden md:inline">{galleryName}</span>
          <span className="leading-tight md:hidden">{stacked}</span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-ui">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "text-oranje"
                        : "text-ink-70 transition-colors hover:text-sumi"
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile menu trigger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="font-sans text-ui text-sumi md:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
        </div>
      </header>

      {/* Mobile full-screen overlay menu — rendered as a sibling of <header>
          (not a child) so its fixed positioning and backdrop-blur resolve
          against the viewport and blur the page, rather than being trapped in
          the header's own backdrop-filter context. */}
      {open ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{
            backgroundColor: "rgba(250, 249, 245, 0.3)",
            backdropFilter: "blur(22px) saturate(1.4)",
            WebkitBackdropFilter: "blur(22px) saturate(1.4)",
          }}
        >
          <div className="page flex items-baseline justify-between py-5">
            <span className="font-sans text-ui font-medium leading-tight tracking-tight text-sumi">
              {stacked}
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="font-sans text-ui text-sumi"
            >
              Close
            </button>
          </div>
          <nav aria-label="Main" className="page mt-16">
            <ul className="flex flex-col gap-5">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setPending(link.href)}
                      aria-current={active ? "page" : undefined}
                      className={`font-sans text-[22px] leading-tight tracking-tight transition-colors duration-150 active:text-oranje ${
                        active || pending === link.href ? "text-oranje" : "text-sumi"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
}
