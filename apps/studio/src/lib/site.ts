/** Shared gallery identity used by emails, documents and newsletters. */
export const GALLERY_NAME = "Joost van den Bergh";
export const GALLERY_ADDRESS = "St James's, London";

/** Default From address for mailings (overridable per campaign / by env). */
export const DEFAULT_FROM =
  process.env.NEWSLETTER_FROM_EMAIL ??
  process.env.EMAIL_FROM ??
  `${GALLERY_NAME} <newsletter@web.joostvandenbergh.com>`;

/** Base URL for public links (unsubscribe, works) in emails. */
export const PUBLIC_BASE_URL =
  process.env.OFFER_LINK_BASE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://joostvandenbergh.com";
