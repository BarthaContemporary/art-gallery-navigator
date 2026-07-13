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
    <footer className="mt-[var(--section)] border-t border-sumi">
      <div className="page grid12 py-16">
        {/* Wordmark + address */}
        <div className="col-span-12 md:col-span-5">
          <p className="font-sans text-ui font-medium text-sumi">{galleryName}</p>
          {settings?.address ? (
            <address className="mt-4 max-w-[var(--measure)] font-serif text-ui not-italic leading-relaxed text-ink-70 whitespace-pre-line">
              {settings.address}
            </address>
          ) : null}
          {settings?.openingHours ? (
            <p className="mt-2 font-serif text-ui text-ink-70">
              {settings.openingHours}
            </p>
          ) : null}
        </div>

        {/* Contact */}
        <div className="col-span-6 mt-8 md:col-span-3 md:mt-0">
          <h2 className="label">Contact</h2>
          <ul className="mt-3 space-y-1.5 font-sans text-ui text-ink-70">
            {settings?.email ? (
              <li>
                <a className="link-inline" href={`mailto:${settings.email}`}>
                  {settings.email}
                </a>
              </li>
            ) : null}
            {settings?.phone ? <li>{settings.phone}</li> : null}
            <li>
              <Link className="link-inline" href="/contact">
                Contact the gallery
              </Link>
            </li>
            {settings?.socials?.map((social) =>
              social.url ? (
                <li key={social._key}>
                  <a
                    className="link-inline"
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

        {/* Visit */}
        <div className="col-span-6 mt-8 md:col-span-2 md:mt-0">
          <h2 className="label">Visit</h2>
          <ul className="mt-3 space-y-1.5 font-sans text-ui text-ink-70">
            <li>
              <Link className="link-inline" href="/visit">
                Book a viewing
              </Link>
            </li>
            <li>
              <Link className="link-inline" href="/faq">
                Collectors&rsquo; FAQ
              </Link>
            </li>
            <li>
              <Link className="link-inline" href="/glossary">
                Glossary
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal */}
        <div className="col-span-12 mt-8 md:col-span-2 md:mt-0">
          <h2 className="label">Legal</h2>
          <ul className="mt-3 space-y-1.5 font-sans text-ui text-ink-70">
            <li>
              <Link className="link-inline" href="/privacy">
                Privacy
              </Link>
            </li>
            <li>
              <Link className="link-inline" href="/terms">
                Terms
              </Link>
            </li>
            <li>
              <Link className="link-inline" href="/cookies">
                Cookies
              </Link>
            </li>
            <li>
              <Link className="link-inline" href="/aml">
                Anti-Money-Laundering
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-hairline">
        <div className="page flex flex-col gap-1 py-6 font-sans text-label text-ink-50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {galleryName}. All works subject to
            availability.
          </p>
        </div>
      </div>
    </footer>
  );
}
