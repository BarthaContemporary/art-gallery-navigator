"use client";

import Script from "next/script";
import { useConsent } from "@/components/consent-provider";

/**
 * Third-party marketing tags. Currently the Meta (Facebook) pixel; other
 * networks would slot in beside it under the same gate.
 *
 * The pixel id arrives as a prop, read server-side from Sanity site settings
 * (with an env fallback). That is deliberate: a `NEXT_PUBLIC_` variable is
 * inlined into the client bundle at build time, so switching the pixel on would
 * have required a redeploy. Sourced from Sanity, pasting the id into site
 * settings and publishing is enough — the pixel is live on the next page load.
 *
 * Two conditions must both hold before anything loads:
 *   1. a pixel id is configured, and
 *   2. the visitor has granted `marketing`.
 *
 * The gate is structural — with either unmet the <Script> is never rendered, so
 * no request reaches Meta and no `_fbp` cookie is written. Unlike analytics,
 * this is genuinely third-party tracking; running it unconsented would be a
 * straightforward PECR breach.
 *
 * Withdrawal note: removing the tag stops further collection but cannot clear
 * cookies Meta has already set. The Cookie Policy says so, and points visitors
 * at their browser controls and Meta's own settings.
 */
export function MarketingScripts({ pixelId }: { pixelId?: string | null }) {
  const { granted } = useConsent();

  const id = (pixelId ?? "").trim();
  // Guard the interpolation target as well as the gate: only digits ever reach
  // the inline script.
  if (!/^\d{10,20}$/.test(id)) return null;
  if (!granted("marketing")) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${id}');
fbq('track','PageView');`}
    </Script>
  );
}
