import sanitizeHtmlLib from "sanitize-html";

/**
 * Allow-list sanitiser for rich-text HTML fragments (maker profiles, AI
 * drafts). Parses to a DOM and permits only the small tag set the editor
 * emits — a real parser, NOT regex, because regex sanitisers are trivially
 * bypassed (e.g. `<img/onerror=…>`, which has no whitespace before the
 * handler). This HTML is stored and later re-inserted via innerHTML, rendered
 * on the public website, and embedded in PDFs, so it must be airtight.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: ["p", "br", "b", "strong", "i", "em", "u", "h2", "h3", "ul", "ol", "li", "a"],
    allowedAttributes: {
      a: ["href", "title"],
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
