"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useConsent } from "@/components/consent-provider";
import { isPrivatePath, plausibleManualSrc } from "@/lib/private-paths";

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
 *
 * Never on a private offer or a newsletter confirmation (lib/private-paths):
 * the page address there is the key to the page, and Plausible records it.
 * The script is Plausible's manual tracker, and the page views are sent from
 * here, one per page, so that pressing Back from a public page to an offer
 * (the same page as far as the browser is concerned, with the script still
 * loaded) is not recorded either. Each page view carries its own address,
 * and none is sent once analytics consent is withdrawn.
 */

type PlausibleFn = ((event: string, options?: { u?: string }) => void) & { q?: unknown[][] };

const DEFAULT_SRC = "https://analytics.joostvandenbergh.com/js/script.js";

export function Plausible() {
  const { granted } = useConsent();
  const pathname = usePathname();
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim();
  const src = plausibleManualSrc(process.env.NEXT_PUBLIC_PLAUSIBLE_SRC?.trim() || DEFAULT_SRC);
  const active = Boolean(domain && src) && granted("analytics");
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    // Checked against the address the browser shows as well as the route:
    // on Back and Forward the two must agree before anything is sent.
    if (isPrivatePath(pathname) || isPrivatePath(window.location.pathname)) {
      lastSent.current = null;
      return;
    }
    // One page view per page shown (React may run this twice for one).
    const href = window.location.href;
    if (lastSent.current === href) return;
    lastSent.current = href;
    const w = window as Window & { plausible?: PlausibleFn };
    // Plausible's own queue, emptied by the script once it has loaded.
    w.plausible ??= Object.assign(
      (...args: unknown[]) => {
        (w.plausible!.q ??= []).push(args);
      },
      { q: [] as unknown[][] },
    ) as PlausibleFn;
    w.plausible("pageview", { u: href });
  }, [active, pathname]);

  if (!active || isPrivatePath(pathname)) return null;
  return <Script defer data-domain={domain} src={src!} strategy="afterInteractive" />;
}
