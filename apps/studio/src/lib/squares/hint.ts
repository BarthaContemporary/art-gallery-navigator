/**
 * Does the catalogue text describe a flat work (painting, drawing, print,
 * photograph, textile)? A pale, even border on such a photograph is the
 * work's own paper or mount, not a studio backdrop.
 */
const FLAT_WORDS =
  /\b(paper|canvas|board|panel|silk|print|prints|woodblock|woodcut|lithograph|etching|engraving|photograph|photography|watercolou?r|gouache|ink|sumi|oil|oils|acrylic|tempera|pastel|charcoal|pencil|crayon|drawing|painting|collage|decalcomania|textile|embroidery|thangka|mandala|miniature|scroll|calligraphy|kakemono|hanging)\b/i;

export function flatWorkHint(...texts: (string | null | undefined)[]): boolean {
  return FLAT_WORDS.test(texts.filter(Boolean).join(" "));
}
