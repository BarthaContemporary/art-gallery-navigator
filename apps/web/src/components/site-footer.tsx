import Link from "next/link";
import type { SiteSettings } from "@/lib/sanity";

export function SiteFooter({
  settings,
  galleryName,
}: {
  settings: SiteSettings | null;
  galleryName: string;
}) {
  return (
    <footer className="border-t border-line-soft bg-band">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="font-bold text-ink-strong">{galleryName}</p>
          {settings?.address ? (
            <address className="mt-2 text-sm not-italic leading-relaxed text-ink-muted whitespace-pre-line">
              {settings.address}
            </address>
          ) : null}
          {settings?.openingHours ? (
            <p className="mt-2 text-sm text-ink-muted">{settings.openingHours}</p>
          ) : null}
        </div>

        <div className="text-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-label-soft">
            Contact
          </h2>
          <ul className="mt-2 space-y-1 text-ink-muted">
            {settings?.email ? (
              <li>
                <a
                  className="hover:text-ink-strong"
                  href={`mailto:${settings.email}`}
                >
                  {settings.email}
                </a>
              </li>
            ) : null}
            {settings?.phone ? <li>{settings.phone}</li> : null}
            <li>
              <Link className="hover:text-ink-strong" href="/contact">
                Contact the gallery
              </Link>
            </li>
            {settings?.socials?.map((social) =>
              social.url ? (
                <li key={social._key}>
                  <a
                    className="hover:text-ink-strong"
                    href={social.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {social.label ?? social.url}
                  </a>
                </li>
              ) : null,
            )}
          </ul>
        </div>

        <div className="text-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-label-soft">
            Visit
          </h2>
          <ul className="mt-2 space-y-1 text-ink-muted">
            <li>
              <Link className="hover:text-ink-strong" href="/visit">
                Book a private viewing
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-strong" href="/faq">
                Collectors&rsquo; FAQ
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-strong" href="/glossary">
                Glossary
              </Link>
            </li>
          </ul>
        </div>

        <div className="text-sm">
          <h2 className="text-xs font-medium uppercase tracking-wide text-ink-label-soft">
            Legal
          </h2>
          <ul className="mt-2 space-y-1 text-ink-muted">
            <li>
              <Link className="hover:text-ink-strong" href="/privacy">
                Privacy Notice
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-strong" href="/terms">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-strong" href="/cookies">
                Cookie Policy
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink-strong" href="/aml">
                Anti-Money-Laundering
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            &copy; {new Date().getFullYear()} {galleryName}. All works subject to availability.
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <Link className="hover:text-ink-mid" href="/privacy">Privacy</Link>
            <Link className="hover:text-ink-mid" href="/terms">Terms</Link>
            <Link className="hover:text-ink-mid" href="/cookies">Cookies</Link>
            <Link className="hover:text-ink-mid" href="/aml">AML</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
