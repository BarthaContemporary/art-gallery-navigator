import sanitizeHtmlLib from "sanitize-html";

/**
 * Allow-list sanitiser for rich-text HTML fragments (maker profiles, AI
 * drafts). Parses to a DOM and permits only a small tag set — a real parser,
 * NOT regex, because regex sanitisers are trivially bypassed (e.g.
 * `<img/onerror=…>`, which has no whitespace before the handler). This HTML
 * is stored and later re-inserted via innerHTML, rendered on the public
 * website, and embedded in PDFs, so it must be airtight.
 *
 * The tag set is what the editor makes, which is more than its toolbar: a
 * contentEditable splits lines typed with Enter into <div>s (Chrome and
 * Safari when the field starts empty, or after a heading; Firefox always),
 * and a paste brings whatever the source page had. A disallowed tag is
 * dropped with nothing in its place, so <div> was the one that ran a whole
 * profile's paragraphs together ("…in 1890.He studied…"). So <div> and
 * <blockquote> are kept (bare: no attribute survives on any tag but <a>),
 * headings outside h2/h3 become the nearest of the two, and a pasted page's
 * section elements and table cells become <div>s.
 *
 * It runs on the way in (the profile route, the AI draft route) and again on
 * the way out (the maker page, before the editor's innerHTML), so the column
 * is never trusted on its own. Running it twice changes nothing.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeHtmlLib(html, {
    allowedTags: [
      "p", "div", "blockquote", "br", "b", "strong", "i", "em", "u", "h2", "h3", "ul", "ol", "li", "a",
    ],
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
    transformTags: {
      // Force safe rel on any surviving links.
      a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
      // Block boundaries a paste brings, kept as the nearest allowed tag
      // rather than dropped (which joined the text either side).
      h1: "h2",
      h4: "h3",
      h5: "h3",
      h6: "h3",
      section: "div",
      article: "div",
      header: "div",
      footer: "div",
      // A pasted table reads one cell to a line (the table itself is dropped).
      td: "div",
      th: "div",
    },
  });
}
