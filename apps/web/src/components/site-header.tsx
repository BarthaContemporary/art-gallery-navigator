"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/site";
import { openSearch } from "@/components/search-overlay";

/** Outlined magnifier at the text's stroke weight — no circle, no box. */
export function SearchIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  );
}

/**
 * Header per handoff 2a/2i: orange sentence-case logo, four nav items and a
 * search icon. Desktop: nav right-aligned on the logo's line. Below md the
 * nav sits on its own row under the logo. No burger, no rule beneath.
 */
export function SiteHeader({ galleryName }: { galleryName: string }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/events") : pathname.startsWith(href);

  return (
    <header className="page pt-6 pb-2 md:pt-7 md:pb-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between md:gap-8">
        <Link
          href="/"
          className="font-sans text-[17px] font-medium leading-none text-accent hover:text-accent-deep md:text-[18px]"
        >
          {galleryName}
        </Link>
        <nav aria-label="Main" className="-ml-2 md:ml-0">
          <ul className="flex flex-wrap items-center gap-x-1 gap-y-0 font-sans text-ui">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-[44px] items-center px-2 transition-colors md:px-3 ${
                      active ? "text-ink" : "text-meta hover:text-ink"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={openSearch}
                aria-label="Search"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center px-2 text-ink hover:text-accent md:pl-3 md:pr-0"
              >
                <SearchIcon />
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
