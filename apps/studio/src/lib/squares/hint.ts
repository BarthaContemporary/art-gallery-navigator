/**
 * Does the catalogue text describe a flat work (painting, drawing, print,
 * photograph, textile)? A pale, even border on such a photograph is the
 * work's own paper or mount, not a studio backdrop.
 *
 * The medium and the title are read separately, and only for what says
 * "flat work" unambiguously. Bare material words are everyday words in an
 * object's title or medium (a hanging flower basket, an oil lamp, a writing
 * box with ink stone, lacquered paper, scroll weights, a go board), and a
 * wrong hint costs an object its rendered square, so:
 *
 *   medium  a support construction ("ink on Japanese paper", "oil on
 *           canvas", "gouache on board", "colour on silk"), a flat-work
 *           process (woodblock, lithograph, etching, screenprint, gelatin
 *           silver, watercolour, gouache, tempera, …), or a textile (a medium
 *           that starts with silk, cotton, linen, hemp or ramie, a dyed
 *           cloth, embroidery). Bare "silk" elsewhere is not enough: "bamboo
 *           with silk cord" is a basket.
 *   title   only unambiguous work types: hanging scroll, handscroll,
 *           kakemono, thangka, miniature painting, calligraphy, painting,
 *           drawing, print, photograph, textile, embroidery.
 *
 * Rows whose stored hint changes are re-analysed at their piece's next sync
 * (the `fresh` check in the sync); Admin → Resync renders the rest.
 * Tested in hint.test.ts.
 */
const SUPPORTS = "paper|papers|silk|canvas|board|panel|card|cardboard|vellum|parchment|linen|cotton|cloth|hemp|mount";
const MEDIUM_FLAT = new RegExp(
  [
    // "… on (up to two words) paper": ink on paper, oil on canvas, colour on silk, ink on Japanese paper.
    `\\bon\\s+(?:[\\p{L}-]+\\s+){0,2}(?:${SUPPORTS})\\b`,
    `\\bink\\s+and\\s+colou?rs?\\b`,
    `\\b(?:woodblock|woodcut|wood\\s+engraving|lithograph(?:y)?|etching|engraving|aquatint|mezzotint|drypoint|screen\\s?print(?:ing)?|silkscreen|serigraph|linocut|monotype|gelatin\\s+silver|albumen|platinum\\s+print|cyanotype|chromogenic|c-print|inkjet\\s+print|gicl[eé]e|photograph(?:y)?|watercolou?r|gouache|tempera|pastel|charcoal|collage|decalcomania|sumi(?:-e)?|kakemono|thangka)\\b`,
    `\\bprints?\\b`,
    // Textiles: the leading material, a dyed cloth, needlework.
    `^\\s*(?:silk|cotton|linen|hemp|ramie)\\b`,
    `\\b(?:[\\p{L}]+-)?dyed\\s+(?:silk|cotton|linen|hemp|ramie|cloth)\\b`,
    `\\b(?:embroider(?:y|ed)|textile|tapestry|kesi)\\b`,
  ].join("|"),
  "iu",
);
const TITLE_FLAT =
  /\b(?:hanging\s+scroll|hand\s?scroll|kakemono|makimono|thangka|miniature\s+painting|calligraphy|paintings?|drawings?|prints?|photographs?|textiles?|embroidery|embroidered)\b/i;

export function flatWorkHint(medium?: string | null, title?: string | null): boolean {
  return Boolean((medium && MEDIUM_FLAT.test(medium)) || (title && TITLE_FLAT.test(title)));
}
