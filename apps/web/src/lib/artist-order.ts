/**
 * One alphabetical convention for artists across the site: accent- and
 * case-insensitive, so Ōhara sits under O and "de Kooning" under D, while
 * spaces still count, so HARA precedes HARADA (names read SURNAME Given).
 * Shared by the event page and the Studio's "Collect works" button, which
 * must agree on what A to Z means.
 */
export const artistCollator = new Intl.Collator("en", { sensitivity: "base" });

export type ArtistNamed = { artist: string | null | undefined; title?: string | null };

/** A to Z by artist, then title; entries without an artist close the run. */
export function compareByArtist(a: ArtistNamed, b: ArtistNamed): number {
  const an = (a.artist ?? "").trim();
  const bn = (b.artist ?? "").trim();
  if (!an || !bn) return an ? -1 : bn ? 1 : 0;
  return (
    artistCollator.compare(an, bn) ||
    artistCollator.compare((a.title ?? "").trim(), (b.title ?? "").trim())
  );
}
