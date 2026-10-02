import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/sanity";
import { absoluteUrl, fallbackGalleryName, siteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SearchOverlay } from "@/components/search-overlay";
import { JsonLd } from "@/components/json-ld";
import { Plausible } from "@/components/plausible";
import { ConsentProvider } from "@/components/consent-provider";
import { ConsentDrawer } from "@/components/consent-drawer";
import { MarketingScripts } from "@/components/marketing-scripts";
import "./fonts.css";
import "./globals.css";

/*
 * One family: Noto Sans. 300 titles, 400 body/nav, 500 logo & names,
 * 600 small labels (handoff design tokens). Japanese glyphs (artist names,
 * titles) fall through to Noto Sans JP, the same design as the Latin. Both
 * are self-hosted from /public/fonts (fonts.css, unicode-range slices):
 * next/font/google fetched them from Google at build time and a changed
 * Google response can fail the build.
 */

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const galleryName = settings?.galleryName ?? fallbackGalleryName;
  const description =
    settings?.defaultSeo?.description ??
    settings?.tagline ??
    "Japanese and Indian works of art — bronzes, metalwork and fine objects for collectors and museums.";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: settings?.defaultSeo?.title ?? galleryName,
      template: `%s — ${galleryName}`,
    },
    description,
    openGraph: {
      siteName: galleryName,
      type: "website",
      url: siteUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  const galleryName = settings?.galleryName ?? fallbackGalleryName;

  const orgJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "ArtGallery",
    name: galleryName,
    url: siteUrl,
  };
  if (settings?.email) orgJsonLd.email = settings.email;
  if (settings?.phone) orgJsonLd.telephone = settings.phone;
  if (settings?.address) {
    orgJsonLd.address = { "@type": "PostalAddress", streetAddress: settings.address };
  }
  if (settings?.socials?.length) {
    orgJsonLd.sameAs = settings.socials.map((s) => s.url).filter(Boolean);
  }
  orgJsonLd.potentialAction = {
    "@type": "ReserveAction",
    target: absoluteUrl("/about"),
    name: "Request an appointment",
  };

  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/fonts/noto-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-screen flex-col bg-page text-body">
        <JsonLd data={orgJsonLd} />
        {/* Everything that can track sits inside the consent provider, so no
            tag can render without first consulting the visitor's decision. */}
        <ConsentProvider>
          <SiteHeader galleryName={galleryName} />
          <main className="flex-1">{children}</main>
          <SiteFooter settings={settings} galleryName={galleryName} />
          <SearchOverlay />
          <Plausible />
          {/* Pixel id comes from Sanity site settings so it can be switched on
              without a deploy; FACEBOOK_PIXEL_ID env is a fallback. */}
          <MarketingScripts
            pixelId={settings?.facebookPixelId ?? process.env.FACEBOOK_PIXEL_ID ?? null}
          />
          <ConsentDrawer />
        </ConsentProvider>
      </body>
    </html>
  );
}
