import Link from "next/link";
import { navLinks } from "@/lib/site";

export function SiteHeader({ galleryName }: { galleryName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft bg-header backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:px-6">
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-ink-strong"
        >
          {galleryName}
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-mid">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-chip px-1 py-0.5 transition-colors hover:text-ink-strong"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
