"use client";

import Script from "next/script";
import { useConsent } from "@/components/consent-provider";

/*
 * Plausible Analytics tag for the public website (self-hosted, cookieless).
 *
 * Renders nothing unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set, so local dev and
 * un-configured deploys stay clean. The domain must match the site's
 * data-domain as registered in the Plausible dashboard.
 *
 * NEXT_PUBLIC_PLAUSIBLE_SRC points at this instance's tracker script; it
 * defaults to the production host if the domain is set but the src is not.
 *
 * Consent: Plausible sets no cookies and stores nothing on the device, so PECR
 * s.6 is arguably not engaged and it ran ungated until now. Once the site shows
 * a banner, running it before a decision would contradict what that banner
 * says — so it now waits for `analytics`. The gate is the early return below:
 * without consent the <Script> is never rendered, so nothing can load.
 */
export function Plausible() {
  const { granted } = useConsent();
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) return null;
  if (!granted("analytics")) return null;

  const src =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ??
    "https://analytics.joostvandenbergh.com/js/script.js";

  return (
    <Script defer data-domain={domain} src={src} strategy="afterInteractive" />
  );
}
