import Link from "next/link";
import type { ReactNode } from "react";

/** Consistent, quiet layout for the legal / policy pages. */
export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">
        <Link href="/" className="hover:text-ink-mid">
          Joost van den Bergh
        </Link>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink-strong">{title}</h1>
      <p className="mt-2 text-[13px] text-ink-soft">Last updated {updated}</p>
      <div className="legal-body mt-8 space-y-6 text-[15px] leading-[1.7] text-ink-body">
        {children}
      </div>
    </main>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.05em] text-ink-strong">
        {heading}
      </h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
