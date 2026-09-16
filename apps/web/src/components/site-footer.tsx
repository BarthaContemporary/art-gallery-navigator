import Link from "next/link";
import type { SiteSettings } from "@/lib/sanity";
import { ConsentReopenLink } from "@/components/consent-reopen-link";
import { NewsletterForm } from "@/components/newsletter-form";

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r=".8" fill="currentColor" />
    </svg>
  );
}

/**
 * Footer per handoff 2a, in the logo orange (client change), white text, two columns — identity
 * and contact on the left, newsletter on the right. The footer's top edge is
 * the only dividing line on the site. A small legal line is the one addition:
 * the privacy, terms and cookie pages must stay reachable from every page.
 */
export function SiteFooter({
  settings,
  galleryName,
}: {
  settings: SiteSettings | null;
  galleryName: string;
}) {
  const instagram =
    settings?.instagram ??
    settings?.socials?.find((s) => /instagram/i.test(`${s.label ?? ""} ${s.url ?? ""}`))?.url ??
    null;
  const addressLines = (settings?.address ?? "St James's, London").split(/\r?\n/).filter(Boolean);
  const visitNote = settings?.visitNote ?? settings?.openingHours ?? "By appointment only";

  return (
    <footer className="mt-[var(--section)] bg-accent text-white">
      <div className="page grid grid-cols-1 gap-10 py-14 md:grid-cols-2 md:gap-16 md:py-16">
        <div className="font-sans text-ui leading-[1.75]">
          <p className="mb-3 text-[19px] font-bold leading-none md:text-[20px]">{galleryName}</p>
          {addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>{visitNote}</p>
          {settings?.phone ? (
            <p>
              <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="hover:opacity-80">
                {settings.phone}
              </a>
            </p>
          ) : null}
          {settings?.email ? (
            <p>
              <a href={`mailto:${settings.email}`} className="hover:opacity-80">
                {settings.email}
              </a>
            </p>
          ) : null}
          {instagram ? (
            <p className="mt-3">
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="inline-flex min-h-[44px] min-w-[44px] items-center hover:opacity-80"
              >
                <InstagramIcon />
              </a>
            </p>
          ) : null}
        </div>

        <div className="w-full md:w-[300px] md:justify-self-end">
          <h2 className="font-sans text-[12px] font-semibold">Newsletter</h2>
          <NewsletterForm />
        </div>
      </div>

      <div className="page flex flex-wrap items-center gap-x-5 gap-y-1 pb-8 font-sans text-[12px] text-white/70">
        <span>&copy; {new Date().getFullYear()} {galleryName}</span>
        <Link href="/privacy" className="hover:text-white">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-white">
          Terms
        </Link>
        <Link href="/cookies" className="hover:text-white">
          Cookies
        </Link>
        <Link href="/aml" className="hover:text-white">
          AML
        </Link>
        <span className="[&_button]:hover:text-white">
          <ConsentReopenLink />
        </span>
      </div>
    </footer>
  );
}
