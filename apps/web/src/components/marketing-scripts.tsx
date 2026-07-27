"use client";

import Script from "next/script";
import { useConsent } from "@/components/consent-provider";

/**
 * Third-party marketing tags. Currently the Meta (Facebook) pixel; other
 * networks slot in beside it under the same gate.
 *
 * Two conditions must both hold before anything loads:
 *   1. the pixel id is configured (NEXT_PUBLIC_FACEBOOK_PIXEL_ID), and
 *   2. the visitor has granted `marketing`.
 *
 * The gate is structural — with either condition unmet the <Script> is never
 * rendered, so no request to Meta is made and no `_fbp` cookie is written.
 * That is deliberate: unlike analytics, this is genuinely third-party tracking
 * and running it without consent would be a straightforward PECR breach.
 *
 * Withdrawal note: removing the tag stops further collection but does not clear
 * cookies Meta already set. The cookie policy should say so plainly, and point
 * visitors at their browser controls.
 */
export function MarketingScripts() {
  const { granted } = useConsent();
  const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;

  if (!pixelId) return null;
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
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');`}
    </Script>
  );
}
