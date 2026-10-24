import sanitizeHtmlLib from "sanitize-html";

/**
 * Allow-list sanitiser for rich-text HTML fragments (maker profiles, AI
 * drafts). Parses to a DOM and permits only the small tag set the editor
 * emits — a real parser, NOT regex, because regex sanitisers are trivially
 * bypassed (e.g. `<img/onerror=…>`, which has no whitespace before the
 * handler). This HTML is stored and later re-inserted via innerHTML, rendered
 * on the public website, and embedded in PDFs, so it must be airtight.
 *
 * It runs on the way in (the profile route, the AI draft route) and again on
 * the way out (the maker page, before the editor's innerHTML), so the column
 * is never trusted on its own. Running it twice changes nothing.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "h2", "h3", "ul", "ol", "li", "a"],
    allowedAttributes: {
      // rel is listed only so the forced value below survives: sanitize-html
      // filters attributes after transformTags, and any rel the input
      // carried is replaced by that value.
      a: ["href", "title", "rel"],
    },
    // Links only http(s)/mailto — blocks javascript:, data:, and obfuscated
    // schemes; sanitize-html decodes entities/whitespace before matching.
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    // Force safe rel on any surviving links.
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
    },
  });
}
