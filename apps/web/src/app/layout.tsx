import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/sanity";
import { fallbackGalleryName, siteUrl } from "@/lib/site";
import { siteJsonLd } from "@/lib/structured-data";
import { DEFAULT_OG_IMAGE, HOME_DESCRIPTION } from "@/lib/seo";
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
    HOME_DESCRIPTION;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: settings?.defaultSeo?.title ?? galleryName,
      template: `%s — ${galleryName}`,
    },
    description,
    // No og:url here: a page that sets none would otherwise claim the home
    // page's address. Pages give their own canonical through `alternates`.
    openGraph: {
      siteName: galleryName,
      type: "website",
      locale: "en_GB",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();
  const galleryName = settings?.galleryName ?? fallbackGalleryName;

  return (
    <html lang="en-GB">
      <head>
        <link rel="preload" href="/fonts/noto-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="flex min-h-screen flex-col bg-page text-body">
        <JsonLd data={siteJsonLd(settings)} />
        {/* Everything that can track sits inside the consent provider, so no
            tag can render without first consulting the visitor's decision.
            Neither tag runs on a private offer or a newsletter confirmation
            (lib/private-paths), whose address is the key to the page. */}
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
