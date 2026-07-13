"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navLinks } from "@/lib/site";

export function SiteHeader({ galleryName }: { galleryName: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-[color-mix(in_srgb,var(--washi)_92%,transparent)] backdrop-blur">
      <div className="page flex items-baseline justify-between gap-6 py-5">
        <Link
          href="/"
          className="font-sans text-ui font-medium tracking-tight text-sumi"
        >
          {galleryName}
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-ui">
            {navLinks.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
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
      </div>
    </header>
  );
}
