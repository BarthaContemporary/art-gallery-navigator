import Script from "next/script";

/*
 * Plausible Analytics tag for the public website (self-hosted, cookieless).
 *
 * Renders nothing unless NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set, so local dev and
 * un-configured deploys stay clean. The domain must match the site's
 * data-domain as registered in the Plausible dashboard.
 *
 * NEXT_PUBLIC_PLAUSIBLE_SRC points at this instance's tracker script; it
 * defaults to the production host if the domain is set but the src is not.
 */
export function Plausible() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;

  const src =
    process.env.NEXT_PUBLIC_PLAUSIBLE_SRC ??
    "https://analytics.joostvandenbergh.com/js/script.js";

  return (
    <Script defer data-domain={domain} src={src} strategy="afterInteractive" />
  );
}
