import type { Metadata } from "next";
import Link from "next/link";
import { getSiteSettings, pageBySlugQuery, sanityFetch, type SitePage } from "@/lib/sanity";
import { PortableText } from "@/components/portable-text";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the gallery — enquiries, viewings and valuations.",
};

export default async function ContactPage() {
  const [page, settings] = await Promise.all([
    sanityFetch<SitePage | null>({
      query: pageBySlugQuery,
      params: { slug: "contact" },
      tags: ["page"],
      fallback: null,
    }),
    getSiteSettings(),
  ]);

  return (
    <div className="page py-16">
      <div className="grid12">
        <div className="col-span-12 md:col-span-8 md:col-start-3">
          <h1 className="font-sans text-h1 font-medium tracking-tight text-sumi">
            Contact
          </h1>

          {page?.body?.length ? (
            <div className="mt-10">
              <PortableText value={page.body} />
            </div>
          ) : (
            <p className="mt-10 max-w-[var(--measure)] font-serif text-body text-ink-70">
              We welcome enquiries about any work on the site, and are happy to
              discuss works we may have that are not yet published. The gallery is
              open by appointment.
            </p>
          )}

          <dl className="mt-10 border-t border-sumi">
            {settings?.email ? (
              <div className="grid grid-cols-[7rem_1fr] gap-4 border-b border-hairline py-3">
                <dt className="label">Email</dt>
                <dd className="font-serif text-ui text-ink-70">
                  <a href={`mailto:${settings.email}`} className="link-inline">
                    {settings.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {settings?.phone ? (
              <div className="grid grid-cols-[7rem_1fr] gap-4 border-b border-hairline py-3">
                <dt className="label">Phone</dt>
                <dd className="font-serif text-ui text-ink-70">{settings.phone}</dd>
              </div>
            ) : null}
            {settings?.address ? (
              <div className="grid grid-cols-[7rem_1fr] gap-4 border-b border-hairline py-3">
                <dt className="label">Address</dt>
                <dd className="whitespace-pre-line font-serif text-ui text-ink-70">
                  {settings.address}
                </dd>
              </div>
            ) : null}
            {settings?.openingHours ? (
              <div className="grid grid-cols-[7rem_1fr] gap-4 border-b border-hairline py-3">
                <dt className="label">Hours</dt>
                <dd className="font-serif text-ui text-ink-70">
                  {settings.openingHours}
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="mt-10 font-serif text-body text-ink-70">
            To see works in person,{" "}
            <Link href="/visit" className="link-inline">
              book a private viewing
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
