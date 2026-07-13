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
    <main className="page py-[var(--section)]">
      <div className="grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <p className="label">
            <Link href="/" className="hover:text-oranje">
              Joost van den Bergh
            </Link>
          </p>
          <h1 className="mt-6 font-sans text-h1 font-medium tracking-tight text-sumi">
            {title}
          </h1>
          <p className="mt-3 label">Last updated {updated}</p>
          <div className="legal-body mt-12 max-w-[var(--measure)] space-y-8 [&_p]:mt-3 [&_p]:font-serif [&_p]:text-body [&_p]:text-ink-70 [&_p:first-child]:mt-0">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="label text-sumi">{heading}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
