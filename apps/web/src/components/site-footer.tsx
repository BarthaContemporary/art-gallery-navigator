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
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-semibold text-ink-strong">{galleryName}</p>
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
      </div>
      <div className="border-t border-line-soft">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-faint sm:px-6">
          &copy; {new Date().getFullYear()} {galleryName}. All works subject to
          availability.
        </p>
      </div>
    </footer>
  );
}
