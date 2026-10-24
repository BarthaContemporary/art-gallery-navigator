"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/components/consent-provider";
import { isPrivatePath } from "@/lib/private-paths";

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
 * Three conditions must all hold before anything loads or is sent:
 *   1. a pixel id is configured,
 *   2. the page is not a private offer or a newsletter confirmation, whose
 *      address is the key to the page (lib/private-paths): the pixel's
 *      PageView reports the full address, which would hand Meta a working
 *      link to a named collector's selection and prices, and
 *   3. the visitor has granted `marketing`.
 *
 * The gate is structural — with any of them unmet Meta's script is never
 * added to the page, so no request reaches Meta and no `_fbp` cookie is
 * written. Unlike analytics, this is genuinely third-party tracking; running
 * it unconsented would be a straightforward PECR breach.
 *
 * Once loaded the script stays for the life of the page, across the site's
 * in-page navigation, Back and Forward included. So it is told not to track
 * history changes itself (disablePushState) nor to send events of its own
 * (autoConfig off): every PageView is sent from here, one per page, after
 * the three checks above. Pressing Back from a public page to an offer the
 * visitor opened first therefore sends nothing, and nothing more is sent once
 * marketing consent is withdrawn.
 *
 * Withdrawal note: stopping the tag cannot clear cookies Meta has already
 * set. The Cookie Policy says so, and points visitors at their browser
 * controls and Meta's own settings.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};
type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq };

const PIXEL_SCRIPT = "https://connect.facebook.net/en_US/fbevents.js";

/** A PageView asked for before Meta's script had loaded. */
let pageViewWaiting = false;

/** Sends a PageView for the address shown now, never for a private page. */
function sendPageView() {
  const fbq = (window as PixelWindow).fbq;
  if (fbq && !isPrivatePath(window.location.pathname)) fbq("track", "PageView");
}

/**
 * Meta's base code, as code rather than an inline <script>: the queueing
 * fbq() stub and fbevents.js, which empties the queue once it has loaded.
 */
function loadPixel(id: string): Fbq {
  const w = window as PixelWindow;
  if (w.fbq) return w.fbq;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  fbq.disablePushState = true;
  w.fbq = fbq;
  if (!w._fbq) w._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = PIXEL_SCRIPT;
  // A PageView queued before the script arrives would be sent for whatever
  // page is shown when it does, so it waits here instead and is sent then,
  // after the address is checked again.
  script.addEventListener("load", () => {
    if (!pageViewWaiting) return;
    pageViewWaiting = false;
    sendPageView();
  });
  document.head.appendChild(script);
  fbq("set", "autoConfig", false, id);
  fbq("init", id);
  return fbq;
}

export function MarketingScripts({ pixelId }: { pixelId?: string | null }) {
  const { granted } = useConsent();
  const pathname = usePathname();

  const id = (pixelId ?? "").trim();
  // Guard the id as well as the gate: only digits ever reach Meta's script.
  const active = /^\d{10,20}$/.test(id) && granted("marketing");
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    // The route and the address the browser shows must both be public.
    if (isPrivatePath(pathname) || isPrivatePath(window.location.pathname)) {
      lastSent.current = null;
      return;
    }
    // One PageView per page shown (React may run this twice for one).
    const href = window.location.href;
    if (lastSent.current === href) return;
    lastSent.current = href;
    const fbq = loadPixel(id);
    if (fbq.callMethod) sendPageView();
    else pageViewWaiting = true;
  }, [active, id, pathname]);

  return null;
}
