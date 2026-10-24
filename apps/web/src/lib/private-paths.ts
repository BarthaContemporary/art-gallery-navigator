/**
 * Pages whose address is itself the key to them: a private offer
 * (/o/<token>) and the newsletter confirmation (/newsletter/confirm/<token>,
 * and the page it leads to). Analytics and marketing tags never report them,
 * because both send the full page address, and the Meta pixel would hand a
 * working link to a named collector's selection and prices to Meta
 * (security review 2026-10, F25). Pure, so form-fields.test.ts can run it
 * directly.
 *
 * Keeping the tags off these pages is not enough on its own. The address
 * also travels:
 *   - as the referrer of the next page, which a tag there reports: these
 *     pages send only the site's address (PRIVATE_PAGE_REFERRER, set as a
 *     response header in next.config.ts and in each page's metadata);
 *   - through the browser history: a visitor who opens an offer, goes on to
 *     a public page (where the tags load) and presses Back is on the offer
 *     again in the same page, with the tags still running. So neither tag
 *     tracks history changes itself: each page view is sent by
 *     components/plausible.tsx and marketing-scripts.tsx, which check the
 *     address first.
 */
export function isPrivatePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/o" || pathname.startsWith("/o/") || pathname === "/newsletter" || pathname.startsWith("/newsletter/");
}

/**
 * The referrer policy of the private pages. A page opened from one of them
 * (a footer link, a new tab, the logo) is told the site's address but not
 * the page's, so its own tags cannot pass the token on. Other sites receive
 * the origin, as they do from every page of the site
 * (strict-origin-when-cross-origin in next.config.ts), so Cloudflare
 * Turnstile and the image hosts see nothing new. The response header covers
 * a page loaded from its address from the first byte; the page's own
 * metadata covers one reached by in-page navigation.
 */
export const PRIVATE_PAGE_REFERRER = "strict-origin" as const;

/**
 * The URL of Plausible's "manual" tracker for the tracker URL configured
 * (NEXT_PUBLIC_PLAUSIBLE_SRC): the same server and folder, file
 * script.manual.js (or plausible.manual.js). The manual tracker sends a
 * page view only when the site asks for one, so the site can leave out the
 * private pages, Back and Forward included; the standard tracker records
 * every history change on its own. Other script extensions are left off on
 * purpose: outbound-link, file-download and tagged-event tracking also send
 * the page address by themselves.
 *
 * Null when the URL does not name a Plausible tracker script: Plausible is
 * then not loaded at all, rather than with a script that might record the
 * private pages.
 */
export function plausibleManualSrc(src: string | null | undefined): string | null {
  const m = /^((?:https?:\/\/[A-Za-z0-9.-]+(?::\d+)?)?\/(?:[A-Za-z0-9._~-]+\/)*)(script|plausible)(?:\.[a-z-]+)*\.js$/.exec(
    (src ?? "").trim(),
  );
  return m ? `${m[1]}${m[2]}.manual.js` : null;
}
