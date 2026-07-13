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
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-strong">Contact</h1>

      {page?.body?.length ? (
        <div className="mt-4">
          <PortableText value={page.body} />
        </div>
      ) : (
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-body">
          We welcome enquiries about any work on the site, and are happy to discuss works we may
          have that are not yet published. The gallery is open by appointment.
        </p>
      )}

      <dl className="mt-8 divide-y divide-line-soft border-y border-line-soft">
        {settings?.email ? (
          <div className="grid grid-cols-[8rem_1fr] gap-4 py-3 text-sm">
            <dt className="text-ink-label-soft">Email</dt>
            <dd>
              <a
                href={`mailto:${settings.email}`}
                className="text-ink-body underline decoration-ink-separator underline-offset-2 hover:text-ink-strong"
              >
                {settings.email}
              </a>
            </dd>
          </div>
        ) : null}
        {settings?.phone ? (
          <div className="grid grid-cols-[8rem_1fr] gap-4 py-3 text-sm">
            <dt className="text-ink-label-soft">Phone</dt>
            <dd className="text-ink-body">{settings.phone}</dd>
          </div>
        ) : null}
        {settings?.address ? (
          <div className="grid grid-cols-[8rem_1fr] gap-4 py-3 text-sm">
            <dt className="text-ink-label-soft">Address</dt>
            <dd className="whitespace-pre-line text-ink-body">{settings.address}</dd>
          </div>
        ) : null}
        {settings?.openingHours ? (
          <div className="grid grid-cols-[8rem_1fr] gap-4 py-3 text-sm">
            <dt className="text-ink-label-soft">Hours</dt>
            <dd className="text-ink-body">{settings.openingHours}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-8 text-sm text-ink-muted">
        To see works in person,{" "}
        <Link
          href="/visit"
          className="underline decoration-ink-separator underline-offset-2 hover:text-ink-strong"
        >
          book a private viewing
        </Link>
        .
      </p>
    </div>
  );
}
