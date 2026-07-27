import type { Metadata } from "next";
import { Newsreader, Noto_Sans } from "next/font/google";
import { getSiteSettings } from "@/lib/sanity";
import { absoluteUrl, fallbackGalleryName, siteUrl } from "@/lib/site";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { Plausible } from "@/components/plausible";
import { ConsentProvider } from "@/components/consent-provider";
import { ConsentDrawer } from "@/components/consent-drawer";
import { MarketingScripts } from "@/components/marketing-scripts";
import "./globals.css";

/*
 * Two families, strict division of labour:
 *   Sans = structure (wordmark, nav, headings, labels, buttons).
 *   Serif = voice (gallery texts, catalogue entries, essays).
 * Noto Sans stands in for Helvetica Neue; Newsreader carries the voice —
 * roman only, weights 300 & 400, no italic.
 */
const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal"],
  variable: "--font-noto-sans",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal"],
  variable: "--font-newsreader",
  display: "swap",
});

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
    target: absoluteUrl("/visit"),
    name: "Book a private viewing",
  };

  return (
    <html lang="en" className={`${notoSans.variable} ${newsreader.variable}`}>
      <body className="flex min-h-screen flex-col bg-washi text-ink-70">
        <JsonLd data={orgJsonLd} />
        {/* Everything that can track sits inside the consent provider, so no
            tag can render without first consulting the visitor's decision. */}
        <ConsentProvider>
          <SiteHeader galleryName={galleryName} />
          <main className="flex-1">{children}</main>
          <SiteFooter settings={settings} galleryName={galleryName} />
          <Plausible />
          <MarketingScripts />
          <ConsentDrawer />
        </ConsentProvider>
      </body>
    </html>
  );
}
